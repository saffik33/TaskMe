from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SharedList(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("user.id"), nullable=True, index=True))
    share_token: str = Field(index=True, unique=True, max_length=64)
    task_ids: str  # JSON-encoded list of task IDs
    created_at: datetime = Field(default_factory=_utcnow)
    expires_at: Optional[datetime] = None
