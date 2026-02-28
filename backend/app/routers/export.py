from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlmodel import select

from ..database import SessionDep
from ..dependencies import CurrentUserDep
from ..models.column_config import ColumnConfig
from ..models.task import Task, TaskPriority, TaskStatus
from ..services.export_service import generate_excel

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/excel")
def export_excel(
    session: SessionDep,
    current_user: CurrentUserDep,
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    owner: Optional[str] = None,
    ids: Optional[str] = Query(default=None, description="Comma-separated task IDs"),
):
    statement = select(Task).where(Task.user_id == current_user.id)

    if ids:
        id_list = [int(i.strip()) for i in ids.split(",") if i.strip().isdigit()]
        statement = statement.where(Task.id.in_(id_list))
    if status:
        statement = statement.where(Task.status == status)
    if priority:
        statement = statement.where(Task.priority == priority)
    if owner:
        statement = statement.where(Task.owner == owner)

    tasks = session.exec(statement).all()
    task_dicts = [
        {
            "id": t.id,
            "task_name": t.task_name,
            "description": t.description,
            "owner": t.owner,
            "email": t.email,
            "start_date": t.start_date,
            "due_date": t.due_date,
            "status": t.status.value if t.status else None,
            "priority": t.priority.value if t.priority else None,
            "custom_fields": t.custom_fields,
            "created_at": t.created_at,
        }
        for t in tasks
    ]

    # Fetch visible custom columns for export (scoped to user)
    custom_cols = session.exec(
        select(ColumnConfig)
        .where(ColumnConfig.user_id == current_user.id, ColumnConfig.is_core == False, ColumnConfig.is_visible == True)
        .order_by(ColumnConfig.position)
    ).all()
    custom_col_dicts = [{"field_key": c.field_key, "display_name": c.display_name} for c in custom_cols]

    buffer = generate_excel(task_dicts, custom_col_dicts if custom_col_dicts else None)
    filename = f"taskme_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
