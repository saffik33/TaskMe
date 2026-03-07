import json
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import col, select

from ..database import SessionDep
from ..dependencies import CurrentUserDep
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
    workspace_id: Optional[int] = None,
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
    if workspace_id:
        statement = select(Task).where(Task.workspace_id == workspace_id, Task.user_id == current_user.id)
    else:
        statement = select(Task).where(Task.user_id == current_user.id)

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


class CopyMoveRequest(BaseModel):
    task_ids: list[int]
    destination_workspace_id: int
    action: str  # "copy" or "move"


@router.post("/copy-move")
def copy_move_tasks(req: CopyMoveRequest, session: SessionDep, current_user: CurrentUserDep):
    from ..models.workspace import WorkspaceMember

    if req.action not in ("copy", "move"):
        raise HTTPException(status_code=400, detail="Action must be 'copy' or 'move'")

    # Verify user has access to destination workspace
    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == req.destination_workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="No access to destination workspace")

    # Fetch tasks that belong to current user
    tasks = session.exec(
        select(Task).where(Task.id.in_(req.task_ids), Task.user_id == current_user.id)
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


@router.get("/{task_id}", response_model=TaskPublic)
def get_task(task_id: int, session: SessionDep, current_user: CurrentUserDep):
    task = session.exec(select(Task).where(Task.id == task_id, Task.user_id == current_user.id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("", response_model=TaskPublic, status_code=201)
def create_task(task_in: TaskCreate, session: SessionDep, current_user: CurrentUserDep, workspace_id: Optional[int] = None):
    task = Task.model_validate(task_in)
    task.user_id = current_user.id
    task.workspace_id = workspace_id
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.post("/bulk", response_model=list[TaskPublic], status_code=201)
def create_bulk_tasks(tasks_in: list[TaskCreate], session: SessionDep, current_user: CurrentUserDep, workspace_id: Optional[int] = None):
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
    task = session.exec(select(Task).where(Task.id == task_id, Task.user_id == current_user.id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
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
def delete_all_tasks(session: SessionDep, current_user: CurrentUserDep):
    tasks = session.exec(select(Task).where(Task.user_id == current_user.id)).all()
    for task in tasks:
        session.delete(task)
    session.commit()
    return {"ok": True, "deleted": len(tasks)}


@router.delete("/{task_id}")
def delete_task(task_id: int, session: SessionDep, current_user: CurrentUserDep):
    task = session.exec(select(Task).where(Task.id == task_id, Task.user_id == current_user.id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    session.delete(task)
    session.commit()
    return {"ok": True}


@router.delete("/bulk/delete")
def delete_bulk_tasks(ids: list[int], session: SessionDep, current_user: CurrentUserDep):
    tasks = session.exec(
        select(Task).where(Task.id.in_(ids), Task.user_id == current_user.id)
    ).all()
    for task in tasks:
        session.delete(task)
    session.commit()
    return {"ok": True}
