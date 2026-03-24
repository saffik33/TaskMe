"""Background scanner for stalled tasks — generates AI nudge messages."""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select, col

from ..config import settings
from ..database import engine
from ..models.task import Task, TaskStatus
from ..services.agent_bridge import get_agent_bridge

logger = logging.getLogger(__name__)

STALLED_DAYS = 3
NUDGE_COOLDOWN_HOURS = 24
SCAN_INTERVAL_SECONDS = 1800  # 30 minutes
AGENT_ID = "follow-up-agent"


def _get_stalled_tasks(db: Session, workspace_id: int, days: int = STALLED_DAYS) -> list[Task]:
    """Find tasks not updated in N days, excluding Done/Cancelled, respecting nudge cooldown."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    nudge_cutoff = datetime.now(timezone.utc) - timedelta(hours=NUDGE_COOLDOWN_HOURS)

    stmt = (
        select(Task)
        .where(
            Task.workspace_id == workspace_id,
            Task.updated_at < cutoff,
            col(Task.status).notin_([TaskStatus.DONE]),
            Task.parent_task_id == None,  # noqa: E711 — skip subtasks
        )
    )
    tasks = list(db.exec(stmt).all())

    # Filter out recently nudged tasks
    return [
        t for t in tasks
        if t.agent_nudge_at is None
        or (t.agent_nudge_at.replace(tzinfo=timezone.utc) if t.agent_nudge_at.tzinfo is None else t.agent_nudge_at) < nudge_cutoff
    ]


async def generate_nudge(task: Task) -> str | None:
    """Generate a nudge message for a stalled task via the follow-up agent."""
    bridge = get_agent_bridge()

    if not settings.AGENTS_API_KEY:
        return None

    updated = task.updated_at.replace(tzinfo=timezone.utc) if task.updated_at.tzinfo is None else task.updated_at
    days_stalled = (datetime.now(timezone.utc) - updated).days

    context = (
        f"Task: {task.task_name}\n"
        f"Status: {task.status}\n"
        f"Priority: {task.priority}\n"
        f"Days since last update: {days_stalled}\n"
    )
    if task.description:
        context += f"Description: {task.description[:200]}\n"
    if task.due_date:
        context += f"Due date: {task.due_date}\n"
    if task.owner:
        context += f"Owner: {task.owner}\n"

    context += "\nGenerate a brief nudge message for this stalled task."

    try:
        import websockets

        _base = settings.AGENTS_SERVICE_URL.replace('https://', '').replace('http://', '')
        _scheme = 'wss' if settings.AGENTS_SERVICE_URL.startswith('https') else 'ws'
        url = (
            f"{_scheme}://{_base}"
            f"/ws/chat?api_key={settings.AGENTS_API_KEY}&agent_id={AGENT_ID}"
        )

        async with websockets.connect(url, open_timeout=10) as ws:
            # Wait for session_established
            raw = await asyncio.wait_for(ws.recv(), timeout=10)

            # Send task context
            await ws.send(json.dumps({"type": "user_message", "content": context}))

            # Collect response
            nudge_text = ""
            for _ in range(20):
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=30)
                    msg = json.loads(raw)
                    msg_type = msg.get("type")

                    if msg_type == "assistant_message":
                        nudge_text = msg.get("content", "")
                        if msg.get("is_final"):
                            break
                    elif msg_type == "tool_approval_request":
                        # Auto-approve server tools
                        await ws.send(json.dumps({
                            "type": "server_tool_approval",
                            "tool_use_id": msg.get("tool_use_id"),
                            "tool_name": msg.get("tool_name"),
                            "approved": True,
                        }))
                    elif msg_type in ("end", "error"):
                        break
                except asyncio.TimeoutError:
                    break

            return nudge_text.strip() if nudge_text.strip() else None

    except Exception as e:
        logger.error("Failed to generate nudge for task %d: %s", task.id, e)
        return None


async def scan_once():
    """Scan all workspaces for stalled tasks and generate nudges."""
    if not settings.AGENTS_API_KEY:
        return

    # Check if agent service is available
    bridge = get_agent_bridge()
    if not await bridge.is_available():
        logger.debug("Agent service unavailable, skipping scan")
        return

    with Session(engine) as db:
        # Get all distinct workspace IDs that have tasks
        workspace_ids = db.exec(
            select(Task.workspace_id).where(Task.workspace_id != None).distinct()  # noqa: E711
        ).all()

        total_nudges = 0
        for ws_id in workspace_ids:
            if ws_id is None:
                continue
            stalled = _get_stalled_tasks(db, ws_id)
            for task in stalled:
                nudge = await generate_nudge(task)
                if nudge:
                    task.agent_nudge = nudge
                    task.agent_nudge_at = datetime.now(timezone.utc)
                    db.add(task)
                    db.commit()
                    total_nudges += 1
                    logger.info("Generated nudge for task %d: %s", task.id, nudge[:60])

        if total_nudges:
            logger.info("Scan complete: %d nudges generated", total_nudges)


async def run_scanner_loop():
    """Background loop that runs the scanner on an interval."""
    # Wait a bit before first scan to let the app start up
    await asyncio.sleep(60)
    while True:
        try:
            await scan_once()
        except Exception as e:
            logger.error("Scanner loop error: %s", e)
        await asyncio.sleep(SCAN_INTERVAL_SECONDS)
