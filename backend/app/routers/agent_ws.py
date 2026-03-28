"""WebSocket relay — bridges frontend ↔ TaskMeAgents WebSocket chat."""

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlmodel import Session

from ..auth import decode_access_token
from ..config import settings
from ..database import engine
from ..models.task import Task
from ..services.agent_bridge import get_agent_bridge

logger = logging.getLogger(__name__)
router = APIRouter(tags=["agent-ws"])

# Tools that the relay handles locally instead of forwarding to the frontend
LOCAL_TOOLS = {"update_task", "create_subtask", "create_subtasks_batch", "list_workspace_members", "list_workspace_tasks"}

# Map LLM priority strings to valid TaskPriority enum values
_PRIORITY_MAP = {"low": "Low", "medium": "Medium", "high": "High", "critical": "Critical"}

def _normalize_priority(val, fallback="Medium"):
    """Normalize LLM priority output to valid TaskPriority value."""
    if val is None:
        return fallback
    s = str(val).strip().lower()
    # Handle "TaskPriority.HIGH" format
    if "." in s:
        s = s.split(".")[-1].lower()
    return _PRIORITY_MAP.get(s, fallback)


async def _get_user_and_task(token: str, task_id: int) -> tuple[int, Task]:
    """Validate JWT and load task in a thread (sync DB)."""
    def _sync():
        try:
            payload = decode_access_token(token)
            user_id = payload.get("user_id")
            if not user_id:
                return None, None
        except JWTError:
            return None, None

        with Session(engine) as session:
            task = session.get(Task, task_id)
            if not task:
                return user_id, None
            # Verify membership
            from ..models.workspace import WorkspaceMember
            from sqlmodel import select
            member = session.exec(
                select(WorkspaceMember).where(
                    WorkspaceMember.workspace_id == task.workspace_id,
                    WorkspaceMember.user_id == user_id,
                    WorkspaceMember.status == "accepted",
                )
            ).first()
            if not member:
                return user_id, None
            # Detach task data we need
            return user_id, Task(
                id=task.id, task_name=task.task_name, description=task.description,
                status=task.status, priority=task.priority, due_date=task.due_date,
                start_date=task.start_date, owner=task.owner, agent_id=task.agent_id,
                agent_session_id=task.agent_session_id, agent_mode=task.agent_mode,
                workspace_id=task.workspace_id, user_id=task.user_id,
            )

    return await asyncio.to_thread(_sync)


async def _execute_local_tool(task_id: int, tool_name: str, params: dict) -> dict:
    """Execute a tool against the local TaskMe DB in a thread."""
    def _sync():
        with Session(engine) as session:
            task = session.get(Task, task_id)
            if not task:
                return {"success": False, "error": "Task not found"}

            if tool_name == "update_task":
                allowed = {"status", "priority", "description", "due_date", "owner"}
                for k, v in params.items():
                    if k in allowed:
                        setattr(task, k, v)
                task.updated_at = datetime.now(timezone.utc)
                session.add(task)
                session.commit()
                return {"success": True, "message": f"Updated task: {list(params.keys())}"}

            elif tool_name == "create_subtask":
                subtask = Task(
                    task_name=params.get("task_name", "Subtask"),
                    description=params.get("description"),
                    priority=_normalize_priority(params.get("priority"), task.priority),
                    due_date=params.get("due_date"),
                    parent_task_id=task_id,
                    workspace_id=task.workspace_id,
                    user_id=task.user_id,
                    status="To Do",
                )
                session.add(subtask)
                session.commit()
                session.refresh(subtask)
                return {"success": True, "task_id": subtask.id, "message": f"Created subtask: {subtask.task_name}"}

            elif tool_name == "create_subtasks_batch":
                subtasks_data = params.get("subtasks", [])
                created = []
                for st in subtasks_data:
                    subtask = Task(
                        task_name=st.get("task_name", "Subtask"),
                        description=st.get("description"),
                        priority=_normalize_priority(st.get("priority"), task.priority),
                        due_date=st.get("due_date"),
                        parent_task_id=task_id,
                        workspace_id=task.workspace_id,
                        user_id=task.user_id,
                        status="To Do",
                    )
                    session.add(subtask)
                    created.append(st.get("task_name", "Subtask"))
                session.commit()
                return {"success": True, "message": f"Created {len(created)} subtasks", "subtasks": created}

            elif tool_name == "list_workspace_members":
                from ..models.workspace import WorkspaceMember
                from ..models.user import User
                from sqlmodel import select
                results = session.exec(
                    select(WorkspaceMember, User)
                    .join(User, WorkspaceMember.user_id == User.id)
                    .where(WorkspaceMember.workspace_id == task.workspace_id, WorkspaceMember.status == "accepted")
                ).all()
                return {"success": True, "members": [{"username": u.username, "role": m.role} for m, u in results]}

            elif tool_name == "list_workspace_tasks":
                from sqlmodel import select
                all_tasks = session.exec(
                    select(Task).where(Task.workspace_id == task.workspace_id)
                ).all()
                return {"success": True, "tasks": [
                    {"id": t.id, "name": t.task_name, "status": t.status, "priority": t.priority,
                     "owner": t.owner, "due_date": str(t.due_date) if t.due_date else None}
                    for t in all_tasks
                ]}

            return {"success": False, "error": f"Unknown tool: {tool_name}"}

    return await asyncio.to_thread(_sync)


async def _save_session_id(task_id: int, session_id: str):
    """Save the agent session ID to the task."""
    def _sync():
        with Session(engine) as session:
            task = session.get(Task, task_id)
            if task:
                task.agent_session_id = session_id
                task.updated_at = datetime.now(timezone.utc)
                session.add(task)
                session.commit()

    await asyncio.to_thread(_sync)


def _build_task_context(task: Task) -> str:
    """Build task context string to prepend to first user message."""
    parts = [
        "[Task Context]",
        f"Name: {task.task_name}",
        f"Status: {task.status}",
        f"Priority: {task.priority}",
    ]
    if task.description:
        parts.append(f"Description: {task.description}")
    if task.due_date:
        parts.append(f"Due Date: {task.due_date}")
    if task.owner:
        parts.append(f"Owner: {task.owner}")
    parts.append("---")
    return "\n".join(parts)


@router.websocket("/ws/agent-chat")
async def agent_chat_ws(ws: WebSocket, task_id: int, token: str):
    """Bidirectional WebSocket relay between frontend and TaskMeAgents."""
    # 1. Auth + load task
    user_id, task = await _get_user_and_task(token, task_id)
    if not user_id:
        await ws.close(code=4001, reason="Invalid token")
        return
    if not task:
        await ws.close(code=4004, reason="Task not found or access denied")
        return
    if not task.agent_id:
        await ws.close(code=4000, reason="No agent bound to task")
        return

    await ws.accept()

    # 2. Get API key
    bridge = get_agent_bridge()
    try:
        api_key = await _ensure_api_key(bridge, user_id)
    except Exception as e:
        logger.error("Failed to get agent API key: %s", e)
        await ws.send_json({"type": "error", "message": "Agent service unavailable", "code": "SERVICE_UNAVAILABLE"})
        await ws.close()
        return

    # 3. Connect upstream to TaskMeAgents
    import websockets

    _base = settings.AGENTS_SERVICE_URL.replace('https://', '').replace('http://', '')
    _scheme = 'wss' if settings.AGENTS_SERVICE_URL.startswith('https') else 'ws'
    upstream_url = f"{_scheme}://{_base}/ws/chat"
    upstream_params = f"?api_key={api_key}&agent_id={task.agent_id}"
    if task.agent_session_id:
        upstream_params += f"&session_id={task.agent_session_id}"

    try:
        upstream = await websockets.connect(
            upstream_url + upstream_params,
            open_timeout=10,
            close_timeout=5,
        )
    except Exception as e:
        logger.error("Failed to connect to agents service: %s", e)
        await ws.send_json({"type": "error", "message": "Agent service unavailable", "code": "SERVICE_UNAVAILABLE"})
        await ws.close()
        return

    first_message = True
    session_saved = False

    # 4. Relay loop
    async def frontend_to_upstream():
        nonlocal first_message
        try:
            while True:
                data = await ws.receive_json()
                # Inject task context on first user message
                if first_message and data.get("type") == "user_message":
                    context = _build_task_context(task)
                    original = data.get("content", "")
                    data["content"] = f"{context}\n{original}"
                    first_message = False
                await upstream.send(json.dumps(data))
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.debug("frontend_to_upstream ended: %s", e)

    async def upstream_to_frontend():
        nonlocal session_saved
        try:
            async for raw in upstream:
                msg = json.loads(raw)
                msg_type = msg.get("type")

                # Intercept session_established to save session_id
                if msg_type == "session_established" and not session_saved:
                    sid = msg.get("session_id")
                    if sid:
                        await _save_session_id(task_id, sid)
                        session_saved = True

                # Auto-approve tool_approval_request for local tools
                if msg_type == "tool_approval_request" and msg.get("tool_name") in LOCAL_TOOLS:
                    tool_name = msg["tool_name"]
                    tool_use_id = msg.get("tool_use_id", "")
                    params = msg.get("parameters", {})

                    # Auto-approve
                    await upstream.send(json.dumps({
                        "type": "server_tool_approval",
                        "tool_use_id": tool_use_id,
                        "tool_name": tool_name,
                        "approved": True,
                    }))

                    # Execute locally
                    result = await _execute_local_tool(task_id, tool_name, params)

                    # Send result to frontend
                    await ws.send_json({
                        "type": "tool_result",
                        "tool_name": tool_name,
                        "tool_use_id": tool_use_id,
                        "success": result.get("success", False),
                        "content": result.get("message", ""),
                        "data": result,
                        "was_auto_approved": True,
                    })
                    continue

                # Intercept client tool execution requests
                if msg_type == "tool_execution_request" and msg.get("tool_name") in LOCAL_TOOLS:
                    tool_name = msg["tool_name"]
                    params = msg.get("parameters", {})
                    tool_use_id = msg.get("tool_use_id", "")

                    # Execute locally
                    result = await _execute_local_tool(task_id, tool_name, params)

                    # Send tool_result to frontend for display
                    await ws.send_json({
                        "type": "tool_result",
                        "tool_name": tool_name,
                        "tool_use_id": tool_use_id,
                        "success": result.get("success", False),
                        "content": result.get("message", ""),
                        "data": result,
                        "was_auto_approved": True,
                    })

                    # Send client_tool_result back to upstream
                    await upstream.send(json.dumps({
                        "type": "client_tool_result",
                        "tool_use_id": tool_use_id,
                        "tool_name": tool_name,
                        "success": result.get("success", False),
                        "content": result.get("message", ""),
                        "result_data": result,
                    }))
                    continue

                # Forward everything else to frontend
                await ws.send_json(msg)

        except Exception as e:
            logger.debug("upstream_to_frontend ended: %s", e)

    # Run both relay tasks concurrently
    try:
        done, pending = await asyncio.wait(
            [
                asyncio.create_task(frontend_to_upstream()),
                asyncio.create_task(upstream_to_frontend()),
            ],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
    finally:
        try:
            await upstream.close()
        except Exception:
            pass
        try:
            await ws.close()
        except Exception:
            pass


async def _ensure_api_key(bridge, user_id: int) -> str:
    """Get or provision API key. Uses sync DB in thread + async httpx for provisioning."""
    from ..models.agent_binding import AgentApiKey
    from sqlmodel import select as sql_select

    # In-memory cache
    if user_id in bridge._key_cache:
        return bridge._key_cache[user_id]

    # Check DB in thread
    def _check_db():
        with Session(engine) as session:
            record = session.exec(
                sql_select(AgentApiKey).where(AgentApiKey.user_id == user_id)
            ).first()
            if record:
                return bridge._decrypt(record.api_key_encrypted)
            return None

    cached = await asyncio.to_thread(_check_db)
    if cached:
        bridge._key_cache[user_id] = cached
        return cached

    # Provision via async httpx
    if not settings.AGENTS_API_KEY:
        raise RuntimeError("Agent service not configured")

    import httpx
    async with httpx.AsyncClient(base_url=settings.AGENTS_SERVICE_URL, timeout=30.0) as client:
        resp = await client.post(
            "/api/keys",
            json={"user_id": bridge._agents_user_id(user_id), "name": f"taskme-user-{user_id}"},
            headers={"X-API-Key": settings.AGENTS_API_KEY},
        )
        resp.raise_for_status()

    raw_key = resp.json()["key"]

    # Store in DB via thread
    def _store_db():
        with Session(engine) as session:
            record = AgentApiKey(user_id=user_id, api_key_encrypted=bridge._encrypt(raw_key))
            session.add(record)
            session.commit()

    await asyncio.to_thread(_store_db)
    bridge._key_cache[user_id] = raw_key
    return raw_key
