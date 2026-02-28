import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
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
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    owner: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = Query(default="created_at"),
    order: Optional[str] = Query(default="desc"),
    offset: int = 0,
    limit: int = Query(default=100, le=500),
):
    statement = select(Task).where(Task.user_id == current_user.id)

    if status:
        statement = statement.where(Task.status == status)
    if priority:
        statement = statement.where(Task.priority == priority)
    if owner:
        statement = statement.where(Task.owner == owner)
    if search:
        statement = statement.where(
            col(Task.task_name).contains(search)
            | col(Task.description).contains(search)
        )

    ALLOWED_SORT = {"task_name", "created_at", "updated_at", "due_date", "start_date", "priority", "status", "owner"}
    sort_column = getattr(Task, sort_by) if sort_by in ALLOWED_SORT else Task.created_at
    if order == "asc":
        statement = statement.order_by(sort_column.asc())
    else:
        statement = statement.order_by(sort_column.desc())

    statement = statement.offset(offset).limit(limit)
    tasks = session.exec(statement).all()
    return tasks


@router.get("/{task_id}", response_model=TaskPublic)
def get_task(task_id: int, session: SessionDep, current_user: CurrentUserDep):
    task = session.exec(select(Task).where(Task.id == task_id, Task.user_id == current_user.id)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("", response_model=TaskPublic, status_code=201)
def create_task(task_in: TaskCreate, session: SessionDep, current_user: CurrentUserDep):
    task = Task.model_validate(task_in)
    task.user_id = current_user.id
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


@router.post("/bulk", response_model=list[TaskPublic], status_code=201)
def create_bulk_tasks(tasks_in: list[TaskCreate], session: SessionDep, current_user: CurrentUserDep):
    tasks = []
    for task_in in tasks_in:
        task = Task.model_validate(task_in)
        task.user_id = current_user.id
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
    for task_id in ids:
        task = session.exec(select(Task).where(Task.id == task_id, Task.user_id == current_user.id)).first()
        if task:
            session.delete(task)
    session.commit()
    return {"ok": True}
