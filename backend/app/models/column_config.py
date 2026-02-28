from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ColumnConfig(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "field_key", name="uq_user_field_key"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("user.id"), nullable=True, index=True))
    field_key: str = Field(index=True, max_length=100)
    display_name: str = Field(max_length=150)
    field_type: str = Field(max_length=20)  # text, number, date, select
    position: int = Field(default=0)
    is_visible: bool = Field(default=True)
    is_core: bool = Field(default=False)
    is_required: bool = Field(default=False)
    options: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=_utcnow)


class ColumnConfigCreate(SQLModel):
    display_name: str
    field_type: str  # text, number, date, select
    options: Optional[str] = None


class ColumnConfigUpdate(SQLModel):
    display_name: Optional[str] = None
    position: Optional[int] = None
    is_visible: Optional[bool] = None
    options: Optional[str] = None


class ColumnConfigPublic(SQLModel):
    id: int
    field_key: str
    display_name: str
    field_type: str
    position: int
    is_visible: bool
    is_core: bool
    is_required: bool
    options: Optional[str] = None
