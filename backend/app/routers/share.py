import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from ..config import settings

logger = logging.getLogger(__name__)
from ..database import SessionDep
from ..dependencies import CurrentUserDep
from ..models.share import SharedList
from ..models.task import Task, TaskPublic

SHARE_LINK_EXPIRY_DAYS = 7

router = APIRouter(prefix="/share", tags=["share"])


class ShareRequest(BaseModel):
    task_ids: list[int]


@router.post("")
def create_share_link(request: ShareRequest, session: SessionDep, current_user: CurrentUserDep):
    # Validate that all task_ids belong to the current user
    owned_tasks = session.exec(
        select(Task).where(Task.id.in_(request.task_ids), Task.user_id == current_user.id)
    ).all()
    owned_ids = {t.id for t in owned_tasks}
    invalid_ids = [tid for tid in request.task_ids if tid not in owned_ids]
    if invalid_ids:
        raise HTTPException(status_code=403, detail="Some tasks do not belong to you")

    token = secrets.token_urlsafe(32)
    shared = SharedList(
        share_token=token,
        task_ids=json.dumps(request.task_ids),
        user_id=current_user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=SHARE_LINK_EXPIRY_DAYS),
    )
    session.add(shared)
    session.commit()
    session.refresh(shared)

    frontend_url = os.getenv("FRONTEND_URL", settings.FRONTEND_URL)
    url = f"{frontend_url}/shared/{token}"
    return {"token": token, "url": url}


@router.get("/{token}", response_model=list[TaskPublic])
def get_shared_tasks(token: str, session: SessionDep):
    try:
        shared = session.exec(
            select(SharedList).where(SharedList.share_token == token)
        ).first()
        if not shared:
            raise HTTPException(status_code=404, detail="Share link not found")
        if shared.expires_at and shared.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Share link has expired")

        task_ids = json.loads(shared.task_ids)
        tasks = session.exec(select(Task).where(Task.id.in_(task_ids))).all()
        return tasks
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Share link error: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Share error: {str(e)}")
