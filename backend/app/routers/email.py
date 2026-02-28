import asyncio

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import select

from ..database import SessionDep
from ..dependencies import CurrentUserDep
from ..models.task import Task
from ..services.email_service import send_task_notification

router = APIRouter(prefix="/email", tags=["email"])
limiter = Limiter(key_func=get_remote_address)


class NotifyRequest(BaseModel):
    task_ids: list[int]
    message: str = ""


@router.post("/notify")
@limiter.limit("5/minute")
def notify_task_owners(request: Request, body: NotifyRequest, session: SessionDep, current_user: CurrentUserDep):
    tasks = session.exec(select(Task).where(Task.id.in_(body.task_ids), Task.user_id == current_user.id)).all()

    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks found")

    sent = 0
    errors = []
    for task in tasks:
        if not task.email:
            continue
        try:
            asyncio.get_event_loop().run_until_complete(
                send_task_notification(
                    to_email=task.email,
                    owner_name=task.owner or "Team Member",
                    task_name=task.task_name,
                    due_date=str(task.due_date) if task.due_date else None,
                    message=body.message,
                )
            )
            sent += 1
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Failed to send email for task %s", task.id)
            errors.append({"task_id": task.id, "error": "Failed to send notification"})

    return {"sent": sent, "errors": errors}
