from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer, Text
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TaskStatus(str, Enum):
    TODO = "To Do"
    IN_PROGRESS = "In Progress"
    DONE = "Done"
    BLOCKED = "Blocked"


class TaskPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class TaskBase(SQLModel):
    task_name: str = Field(index=True, max_length=255)
    description: Optional[str] = None
    owner: Optional[str] = Field(default=None, index=True, max_length=150)
    email: Optional[str] = Field(default=None, max_length=255)
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    status: TaskStatus = Field(default=TaskStatus.TODO, index=True)
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM, index=True)
    custom_fields: Optional[str] = Field(default=None, sa_column=Column(Text))


class Task(TaskBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("user.id"), nullable=True, index=True))
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class TaskCreate(TaskBase):
    pass


class TaskUpdate(SQLModel):
    task_name: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None
    email: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    custom_fields: Optional[str] = None


class TaskPublic(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime
