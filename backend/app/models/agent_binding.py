from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AgentApiKey(SQLModel, table=True):
    """Stores encrypted TaskMeAgents API keys per user."""

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id"), nullable=False, unique=True)
    )
    api_key_encrypted: str  # Fernet-encrypted raw TaskMeAgents API key
    created_at: datetime = Field(default_factory=_utcnow)
