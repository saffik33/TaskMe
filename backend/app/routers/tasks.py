import json
import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import col, select

logger = logging.getLogger(__name__)

from ..database import SessionDep
from ..dependencies import CurrentUserDep, get_workspace_member, require_editor
from ..models.task import (
    Task,
    TaskCreate,
    TaskPriority,
    TaskPublic,
    TaskStatus,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskPublic])
def list_tasks(
    session: SessionDep,
    current_user: CurrentUserDep,
    workspace_id: int = Query(...),
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    owner: Optional[str] = None,
    search: Optional[str] = None,
    statuses: Optional[str] = None,
    priorities: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    sort_by: Optional[str] = Query(default="created_at"),
    order: Optional[str] = Query(default="desc"),
    offset: int = 0,
    limit: int = Query(default=100, le=500),
):
    # Verify workspace membership (any role can read)
    get_workspace_member(workspace_id, session, current_user)
    statement = select(Task).where(Task.workspace_id == workspace_id)

    if status:
        statement = statement.where(Task.status == status)
    if priority:
        statement = statement.where(Task.priority == priority)
    if owner:
        statement = statement.where(Task.owner == owner)
    if search:
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        statement = statement.where(
            col(Task.task_name).ilike(pattern)
            | col(Task.description).ilike(pattern)
            | col(Task.owner).ilike(pattern)
            | col(Task.email).ilike(pattern)
        )
    if statuses:
        try:
            status_list = [TaskStatus(s.strip()) for s in statuses.split(",")]
        except ValueError:
            valid = [s.value for s in TaskStatus]
            raise HTTPException(status_code=400, detail=f"Invalid status value. Valid statuses: {valid}")
        statement = statement.where(col(Task.status).in_(status_list))
    if priorities:
        try:
            priority_list = [TaskPriority(p.strip()) for p in priorities.split(",")]
        except ValueError:
            valid = [p.value for p in TaskPriority]
            raise HTTPException(status_code=400, detail=f"Invalid priority value. Valid priorities: {valid}")
        statement = statement.where(col(Task.priority).in_(priority_list))
    if date_from:
        statement = statement.where(Task.due_date >= date_from)
    if date_to:
        statement = statement.where(Task.due_date <= date_to)

    ALLOWED_SORT = {"task_name", "created_at", "updated_at", "due_date", "start_date", "priority", "status", "owner"}
    sort_column = getattr(Task, sort_by) if sort_by in ALLOWED_SORT else Task.created_at
    if order == "asc":
        statement = statement.order_by(sort_column.asc())
    else:
        statement = statement.order_by(sort_column.desc())

    statement = statement.offset(offset).limit(limit)
    tasks = session.exec(statement).all()
    return tasks


class SmartSearchRequest(BaseModel):
    query: str = Field(..., max_length=500)
    provider: Optional[str] = None


@router.post("/smart-search")
def smart_search(body: SmartSearchRequest, current_user: CurrentUserDep):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    try:
        from ..services.llm_service import parse_search_query
        filters = parse_search_query(body.query, provider=body.provider)
        return {"filters": filters}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except json.JSONDecodeError:
        logger.warning("LLM returned malformed JSON for smart search query")
        raise HTTPException(status_code=502, detail="AI returned an unparseable response. Try rephrasing your query.")
    except Exception:
        logger.exception("Smart search parsing failed")
        raise HTTPException(status_code=500, detail="Failed to parse search query. Please try again.")


class CopyMoveRequest(BaseModel):
    task_ids: list[int]
    destination_workspace_id: int
    action: str  # "copy" or "move"


@router.post("/copy-move")
def copy_move_tasks(req: CopyMoveRequest, session: SessionDep, current_user: CurrentUserDep):
    if req.action not in ("copy", "move"):
        raise HTTPException(status_code=400, detail="Action must be 'copy' or 'move'")

    # Verify editor+ on destination workspace
    require_editor(req.destination_workspace_id, session, current_user)

    # Fetch tasks and verify user has editor+ access to their source workspace(s)
    from ..models.workspace import WorkspaceMember
    editable_memberships = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.status == "accepted",
            WorkspaceMember.role != "viewer",
        )
    ).all()
    editable_ws_ids = [m.workspace_id for m in editable_memberships]
    tasks = session.exec(
        select(Task).where(Task.id.in_(req.task_ids), Task.workspace_id.in_(editable_ws_ids))
    ).all()
    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks found")

    count = len(tasks)

    if req.action == "copy":
        for t in tasks:
            new_task = Task(
                task_name=t.task_name,
                description=t.description,
                owner=t.owner,
                email=t.email,
                start_date=t.start_date,
                due_date=t.due_date,
                status=t.status,
                priority=t.priority,
                custom_fields=t.custom_fields,
                user_id=current_user.id,
                workspace_id=req.destination_workspace_id,
            )
            session.add(new_task)
        session.commit()
    else:  # move
        for t in tasks:
            t.workspace_id = req.destination_workspace_id
            session.add(t)
        session.commit()

    return {"ok": True, "count": count, "action": req.action}


def _get_task_with_access(task_id: int, session: SessionDep, current_user: CurrentUserDep):
    """Fetch task and verify user is a member of its workspace. Returns (task, member) or raises 404."""
    from ..models.workspace import WorkspaceMember
    task = session.get(Task, task_id)
    if not task or not task.workspace_id:
        raise HTTPException(status_code=404, detail="Task not found")
    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == task.workspace_id,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.status == "accepted",
        )
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Task not found")
    return task, member


@router.get("/{task_id}", response_model=TaskPublic)
def get_task(task_id: int, session: SessionDep, current_user: CurrentUserDep):
    task, _member = _get_task_with_access(task_id, session, current_user)
    return task


@router.post("", response_model=TaskPublic, status_code=201)
def create_task(task_in: TaskCreate, session: SessionDep, current_user: CurrentUserDep, workspace_id: int = Query(...)):
    require_editor(workspace_id, session, current_user)
    task = Task.model_validate(task_in)
    task.user_id = current_user.id
    task.workspace_id = workspace_id
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.post("/bulk", response_model=list[TaskPublic], status_code=201)
def create_bulk_tasks(tasks_in: list[TaskCreate], session: SessionDep, current_user: CurrentUserDep, workspace_id: int = Query(...)):
    require_editor(workspace_id, session, current_user)
    tasks = []
    for task_in in tasks_in:
        task = Task.model_validate(task_in)
        task.user_id = current_user.id
        task.workspace_id = workspace_id
        session.add(task)
        tasks.append(task)
    session.commit()
    for task in tasks:
        session.refresh(task)
    return tasks


@router.patch("/{task_id}", response_model=TaskPublic)
def update_task(task_id: int, task_in: TaskUpdate, session: SessionDep, current_user: CurrentUserDep):
    task, member = _get_task_with_access(task_id, session, current_user)
    if member.role == "viewer":
        raise HTTPException(status_code=403, detail="Editor access required")
    update_data = task_in.model_dump(exclude_unset=True)

    # Merge custom_fields instead of replacing
    if "custom_fields" in update_data and update_data["custom_fields"] is not None:
        try:
            existing_cf = json.loads(task.custom_fields or "{}")
            incoming_cf = json.loads(update_data["custom_fields"])
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in custom_fields")
        existing_cf.update(incoming_cf)
        update_data["custom_fields"] = json.dumps(existing_cf)

    task.sqlmodel_update(update_data)
    task.updated_at = datetime.now(timezone.utc)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.delete("/all")
def delete_all_tasks(session: SessionDep, current_user: CurrentUserDep, workspace_id: int = Query(...)):
    require_editor(workspace_id, session, current_user)
    tasks = session.exec(select(Task).where(Task.workspace_id == workspace_id)).all()
    for task in tasks:
        session.delete(task)
    session.commit()
    return {"ok": True, "deleted": len(tasks)}


@router.delete("/{task_id}")
def delete_task(task_id: int, session: SessionDep, current_user: CurrentUserDep):
    task, member = _get_task_with_access(task_id, session, current_user)
    if member.role == "viewer":
        raise HTTPException(status_code=403, detail="Editor access required")
    session.delete(task)
    session.commit()
    return {"ok": True}


@router.delete("/bulk/delete")
def delete_bulk_tasks(ids: list[int], session: SessionDep, current_user: CurrentUserDep):
    from ..models.workspace import WorkspaceMember
    # Get all workspace IDs user is an editor+ member of
    memberships = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.status == "accepted",
            WorkspaceMember.role != "viewer",
        )
    ).all()
    editable_ws_ids = [m.workspace_id for m in memberships]
    tasks = session.exec(
        select(Task).where(Task.id.in_(ids), Task.workspace_id.in_(editable_ws_ids))
    ).all()
    for task in tasks:
        session.delete(task)
    session.commit()
    return {"ok": True}
