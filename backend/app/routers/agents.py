"""Agent management REST endpoints for TaskMe."""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from ..config import settings
from ..database import SessionDep, engine
from ..dependencies import CurrentUserDep, get_workspace_member, require_editor
from ..models.task import Task, TaskPublic
from ..services.agent_bridge import get_agent_bridge

logger = logging.getLogger(__name__)
router = APIRouter(tags=["agents"])


# --- Schemas ---

class AgentBindRequest(BaseModel):
    agent_id: str
    mode: str = "assistive"  # manual | assistive | autonomous


class AgentStatusResponse(BaseModel):
    agent_id: Optional[str] = None
    agent_mode: Optional[str] = None
    agent_status: Optional[str] = None
    agent_session_id: Optional[str] = None
    session_info: Optional[dict] = None


# --- Helper ---

def _get_task(task_id: int, workspace_id: int, session: SessionDep) -> Task:
    task = session.get(Task, task_id)
    if not task or task.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


# --- Endpoints ---

@router.get("/agents/templates")
async def list_agent_templates(_: CurrentUserDep):
    """List available agent templates from the agents service."""
    bridge = get_agent_bridge()
    return await bridge.list_agent_templates()


@router.get("/agents/health")
async def agent_health(_: CurrentUserDep):
    """Check if agents service is available."""
    bridge = get_agent_bridge()
    available = await bridge.is_available()
    return {"available": available}


@router.post("/tasks/{task_id}/agent/bind", response_model=TaskPublic)
async def bind_agent(
    task_id: int,
    body: AgentBindRequest,
    workspace_id: int = Query(...),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
):
    """Bind an agent template to a task."""
    require_editor(workspace_id, session, current_user)
    task = _get_task(task_id, workspace_id, session)

    if body.mode not in ("manual", "assistive", "autonomous"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    # Ensure user has an API key provisioned (lazy creation)
    bridge = get_agent_bridge()
    await bridge.ensure_user_api_key(current_user.id, session)

    task.agent_id = body.agent_id
    task.agent_mode = body.mode
    task.agent_status = "idle"
    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.post("/tasks/{task_id}/agent/unbind", response_model=TaskPublic)
async def unbind_agent(
    task_id: int,
    workspace_id: int = Query(...),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
):
    """Remove agent binding from a task."""
    require_editor(workspace_id, session, current_user)
    task = _get_task(task_id, workspace_id, session)

    task.agent_id = None
    task.agent_mode = None
    task.agent_status = None
    task.agent_session_id = None
    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.get("/tasks/{task_id}/agent/status", response_model=AgentStatusResponse)
async def get_agent_status(
    task_id: int,
    workspace_id: int = Query(...),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
):
    """Get agent status for a task."""
    get_workspace_member(workspace_id, session, current_user)
    task = _get_task(task_id, workspace_id, session)

    result = AgentStatusResponse(
        agent_id=task.agent_id,
        agent_mode=task.agent_mode,
        agent_status=task.agent_status,
        agent_session_id=task.agent_session_id,
    )

    # Fetch session info from agents service if available
    if task.agent_session_id:
        bridge = get_agent_bridge()
        try:
            api_key = await bridge.ensure_user_api_key(current_user.id, session)
            result.session_info = await bridge.get_session(api_key, task.agent_session_id)
        except Exception:
            pass

    return result


@router.get("/tasks/{task_id}/agent/messages")
async def get_agent_messages(
    task_id: int,
    workspace_id: int = Query(...),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
):
    """Get chat message history for a task's agent session."""
    get_workspace_member(workspace_id, session, current_user)
    task = _get_task(task_id, workspace_id, session)

    if not task.agent_session_id:
        return []

    bridge = get_agent_bridge()
    api_key = await bridge.ensure_user_api_key(current_user.id, session)
    return await bridge.get_session_messages(api_key, task.agent_session_id)


@router.post("/tasks/{task_id}/agent/execute")
async def trigger_agent_execution(
    task_id: int,
    workspace_id: int = Query(...),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
):
    """Trigger autonomous agent execution for a task."""
    require_editor(workspace_id, session, current_user)
    task = _get_task(task_id, workspace_id, session)

    if not task.agent_id:
        raise HTTPException(status_code=400, detail="No agent bound to task")
    if task.agent_mode != "autonomous":
        raise HTTPException(status_code=400, detail="Task not in autonomous mode")

    task.agent_status = "executing"
    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    session.commit()
    session.refresh(task)
    return {"status": "executing", "task_id": task_id}


@router.get("/tasks/{task_id}/subtasks", response_model=list[TaskPublic])
async def list_subtasks(
    task_id: int,
    workspace_id: int = Query(...),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
):
    """List subtasks of a task."""
    get_workspace_member(workspace_id, session, current_user)
    _get_task(task_id, workspace_id, session)
    subtasks = session.exec(
        select(Task).where(Task.parent_task_id == task_id, Task.workspace_id == workspace_id)
    ).all()
    return subtasks


@router.post("/tasks/{task_id}/agent/breakdown")
async def breakdown_task(
    task_id: int,
    workspace_id: int = Query(...),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
):
    """Break a task into subtasks using the task-breakdown agent.

    One-shot operation: opens a temporary WS to TaskMeAgents, sends task context,
    intercepts create_subtasks_batch tool call, creates subtasks, returns them.
    """
    require_editor(workspace_id, session, current_user)
    task = _get_task(task_id, workspace_id, session)

    bridge = get_agent_bridge()
    api_key = await bridge.ensure_user_api_key(current_user.id, session)

    # Build task context message
    parts = [
        f"Task: {task.task_name}",
        f"Status: {task.status}",
        f"Priority: {task.priority}",
    ]
    if task.description:
        parts.append(f"Description: {task.description}")
    if task.due_date:
        parts.append(f"Due Date: {task.due_date}")
    if task.owner:
        parts.append(f"Owner: {task.owner}")
    context_msg = "\n".join(parts) + "\n\nBreak this task into actionable subtasks."

    # Open temporary WS to TaskMeAgents
    import websockets

    _base = settings.AGENTS_SERVICE_URL.replace('https://', '').replace('http://', '')
    _scheme = 'wss' if settings.AGENTS_SERVICE_URL.startswith('https') else 'ws'
    upstream_url = f"{_scheme}://{_base}/ws/chat"
    upstream_params = f"?api_key={api_key}&agent_id=task-breakdown"

    created_subtasks = []

    try:
        async with websockets.connect(upstream_url + upstream_params, open_timeout=10, close_timeout=5) as ws:
            # Wait for session_established
            raw = await asyncio.wait_for(ws.recv(), timeout=10)
            msg = json.loads(raw)
            if msg.get("type") != "session_established":
                raise HTTPException(status_code=502, detail="Unexpected response from agent service")

            # Send the breakdown request
            await ws.send(json.dumps({
                "type": "user_message",
                "content": context_msg,
            }))

            # Collect messages until we get the tool call or end
            timeout_at = asyncio.get_event_loop().time() + 60  # 60s max
            while asyncio.get_event_loop().time() < timeout_at:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=30)
                except asyncio.TimeoutError:
                    break

                msg = json.loads(raw)
                msg_type = msg.get("type")

                # Handle tool approval request — auto-approve and wait for result
                if msg_type == "tool_approval_request" and msg.get("tool_name") == "create_subtasks_batch":
                    subtasks_data = msg.get("parameters", {}).get("subtasks", [])
                    tool_use_id = msg.get("tool_use_id", "")

                    if subtasks_data:
                        # We have the params from the approval request — create subtasks now
                        def _create_from_approval():
                            with Session(engine) as db:
                                results = []
                                for st in subtasks_data:
                                    subtask = Task(
                                        task_name=st.get("task_name", "Subtask"),
                                        description=st.get("description"),
                                        priority=st.get("priority", task.priority),
                                        due_date=st.get("due_date"),
                                        parent_task_id=task_id,
                                        workspace_id=task.workspace_id,
                                        user_id=task.user_id,
                                        status="To Do",
                                    )
                                    db.add(subtask)
                                    results.append(st)
                                db.commit()
                                return results
                        created_subtasks = await asyncio.to_thread(_create_from_approval)

                    # Approve the tool so the workflow continues
                    await ws.send(json.dumps({
                        "type": "server_tool_approval",
                        "tool_use_id": tool_use_id,
                        "tool_name": "create_subtasks_batch",
                        "approved": True,
                    }))

                    # Wait for completion
                    try:
                        while True:
                            raw = await asyncio.wait_for(ws.recv(), timeout=15)
                            end_msg = json.loads(raw)
                            if end_msg.get("type") in ("end", "error"):
                                break
                    except (asyncio.TimeoutError, Exception):
                        pass
                    break

                if msg_type == "tool_execution_request" and msg.get("tool_name") == "create_subtasks_batch":
                    # Execute the tool locally (client tool path)
                    subtasks_data = msg.get("parameters", {}).get("subtasks", [])
                    tool_use_id = msg.get("tool_use_id", "")

                    def _create_subtasks():
                        with Session(engine) as db:
                            results = []
                            for st in subtasks_data:
                                subtask = Task(
                                    task_name=st.get("task_name", "Subtask"),
                                    description=st.get("description"),
                                    priority=st.get("priority", task.priority),
                                    due_date=st.get("due_date"),
                                    parent_task_id=task_id,
                                    workspace_id=task.workspace_id,
                                    user_id=task.user_id,
                                    status="To Do",
                                )
                                db.add(subtask)
                                results.append(st)
                            db.commit()
                            return results

                    created_subtasks = await asyncio.to_thread(_create_subtasks)

                    # Send tool result back so agent completes cleanly
                    await ws.send(json.dumps({
                        "type": "client_tool_result",
                        "tool_use_id": tool_use_id,
                        "tool_name": "create_subtasks_batch",
                        "success": True,
                        "content": f"Created {len(created_subtasks)} subtasks",
                        "result_data": {"count": len(created_subtasks)},
                    }))

                    # Wait briefly for agent to finish
                    try:
                        while True:
                            raw = await asyncio.wait_for(ws.recv(), timeout=10)
                            end_msg = json.loads(raw)
                            if end_msg.get("type") == "end":
                                break
                    except (asyncio.TimeoutError, Exception):
                        pass
                    break

                elif msg_type == "end":
                    break
                elif msg_type == "error":
                    raise HTTPException(status_code=502, detail=msg.get("message", "Agent error"))

            # Send end_conversation
            try:
                await ws.send(json.dumps({"type": "end_conversation", "reason": "breakdown_complete"}))
            except Exception:
                pass

    except websockets.exceptions.WebSocketException as e:
        logger.error("Breakdown WS error: %s", e)
        raise HTTPException(status_code=503, detail="Agent service unavailable")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Breakdown error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to break down task")

    if not created_subtasks:
        raise HTTPException(status_code=422, detail="Agent did not generate subtasks")

    return {
        "task_id": task_id,
        "subtasks_created": len(created_subtasks),
        "subtasks": created_subtasks,
    }


# --- Stalled Tasks + Scanner ---

@router.get("/tasks/stalled")
async def get_stalled_tasks(
    workspace_id: int = Query(...),
    days: int = Query(3),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
):
    """List tasks not updated in N days (excluding Done/Cancelled)."""
    from ..services.followup_scanner import _get_stalled_tasks

    # Auth check
    get_workspace_member(workspace_id, session, current_user)

    stalled = _get_stalled_tasks(session, workspace_id, days)
    return [TaskPublic.model_validate(t) for t in stalled]


@router.post("/scanner/run")
async def trigger_scanner(_: CurrentUserDep):
    """Debug endpoint: manually trigger the follow-up scanner."""
    from ..services.followup_scanner import scan_once
    asyncio.create_task(scan_once())
    return {"status": "scanner triggered"}
