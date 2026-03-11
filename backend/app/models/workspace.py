import secrets
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlmodel import Field, SQLModel


class WorkspaceRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Workspace(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    owner_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id"), nullable=False, index=True))
    created_at: datetime = Field(default_factory=_utcnow)


class WorkspaceMember(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    workspace_id: int = Field(sa_column=Column(Integer, ForeignKey("workspace.id", ondelete="CASCADE"), nullable=False, index=True))
    user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id"), nullable=False, index=True))
    role: str = Field(default="owner", max_length=20)
    status: str = Field(default="accepted", max_length=20)
    inviter_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("user.id"), nullable=True))
    joined_at: datetime = Field(default_factory=_utcnow)


def _invite_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=7)


class WorkspaceInvite(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    workspace_id: int = Field(sa_column=Column(Integer, ForeignKey("workspace.id", ondelete="CASCADE"), nullable=False, index=True))
    email: str = Field(max_length=255, sa_column=Column(String(255), nullable=False, index=True))
    role: str = Field(default="editor", max_length=20)
    inviter_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id"), nullable=False))
    token: str = Field(default_factory=lambda: secrets.token_urlsafe(32), max_length=64, sa_column=Column(String(64), nullable=False, unique=True, index=True))
    created_at: datetime = Field(default_factory=_utcnow)
    expires_at: datetime = Field(default_factory=_invite_expiry)


class WorkspaceCreate(SQLModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)


class WorkspaceUpdate(SQLModel):
    name: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None


class WorkspacePublic(SQLModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int
    created_at: datetime
    role: Optional[str] = None
