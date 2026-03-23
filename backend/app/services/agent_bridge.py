"""Agent Bridge — HTTP proxy to TaskMeAgents service with auth bridging."""

import base64
import hashlib
import logging
from typing import Optional

import httpx
from cryptography.fernet import Fernet
from fastapi import HTTPException
from sqlmodel import Session, select

from ..config import settings
from ..models.agent_binding import AgentApiKey

logger = logging.getLogger(__name__)


def _derive_fernet_key(secret: str) -> bytes:
    """Derive a Fernet-compatible key from JWT_SECRET_KEY via SHA-256."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


class AgentBridge:
    """Proxy to TaskMeAgents service. Handles auth bridging and HTTP calls."""

    def __init__(self):
        self._client = httpx.AsyncClient(
            base_url=settings.AGENTS_SERVICE_URL,
            timeout=30.0,
        )
        self._fernet = Fernet(_derive_fernet_key(settings.JWT_SECRET_KEY))
        self._key_cache: dict[int, str] = {}  # user_id -> decrypted key (TTL via dict size)

    def _encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def _decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode()).decode()

    def _agents_user_id(self, user_id: int) -> str:
        """Map TaskMe integer user_id to TaskMeAgents string user_id."""
        return f"taskme-user-{user_id}"

    async def ensure_user_api_key(self, user_id: int, db_session: Session) -> str:
        """Get cached API key or provision a new one from TaskMeAgents."""
        # In-memory cache check
        if user_id in self._key_cache:
            return self._key_cache[user_id]

        # DB check
        record = db_session.exec(
            select(AgentApiKey).where(AgentApiKey.user_id == user_id)
        ).first()
        if record:
            key = self._decrypt(record.api_key_encrypted)
            self._key_cache[user_id] = key
            return key

        # Provision new key from TaskMeAgents
        if not settings.AGENTS_API_KEY:
            raise HTTPException(status_code=503, detail="Agent service not configured")

        try:
            resp = await self._client.post(
                "/api/keys",
                json={
                    "user_id": self._agents_user_id(user_id),
                    "name": f"taskme-user-{user_id}",
                },
                headers={"X-API-Key": settings.AGENTS_API_KEY},
            )
            resp.raise_for_status()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
            logger.error("Failed to provision agent API key: %s", e)
            raise HTTPException(status_code=503, detail="Agent service unavailable")

        raw_key = resp.json()["key"]

        # Store encrypted
        record = AgentApiKey(
            user_id=user_id,
            api_key_encrypted=self._encrypt(raw_key),
        )
        db_session.add(record)
        db_session.commit()

        self._key_cache[user_id] = raw_key
        return raw_key

    async def list_agent_templates(self) -> list[dict]:
        """GET /api/agents — list all agent templates."""
        try:
            resp = await self._client.get(
                "/api/agents",
                headers={"X-API-Key": settings.AGENTS_API_KEY},
            )
            resp.raise_for_status()
            return resp.json()
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error("Agent service unavailable: %s", e)
            raise HTTPException(status_code=503, detail="Agent service unavailable")

    async def get_session_messages(self, api_key: str, session_id: str) -> list[dict]:
        """GET /api/sessions/{id}/messages."""
        try:
            resp = await self._client.get(
                f"/api/sessions/{session_id}/messages",
                headers={"X-API-Key": api_key},
            )
            resp.raise_for_status()
            return resp.json()
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error("Agent service unavailable: %s", e)
            raise HTTPException(status_code=503, detail="Agent service unavailable")
        except httpx.HTTPStatusError:
            return []

    async def get_session(self, api_key: str, session_id: str) -> Optional[dict]:
        """GET /api/sessions/{id}."""
        try:
            resp = await self._client.get(
                f"/api/sessions/{session_id}",
                headers={"X-API-Key": api_key},
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()
        except (httpx.ConnectError, httpx.TimeoutException):
            return None

    async def is_available(self) -> bool:
        """Check if agents service is healthy."""
        try:
            resp = await self._client.get("/health", timeout=5.0)
            return resp.status_code == 200
        except Exception:
            return False

    # ── Admin proxy methods (use master AGENTS_API_KEY) ──

    async def proxy_get(self, path: str, params: dict | None = None) -> dict | list:
        """GET proxy to TaskMeAgents with admin key."""
        try:
            resp = await self._client.get(
                path,
                params=params,
                headers={"X-API-Key": settings.AGENTS_API_KEY},
            )
            resp.raise_for_status()
            return resp.json()
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error("Agent service unavailable: %s", e)
            raise HTTPException(status_code=503, detail="Agent service unavailable")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)

    async def proxy_post(self, path: str, body: dict) -> dict:
        """POST proxy to TaskMeAgents with admin key."""
        try:
            resp = await self._client.post(
                path,
                json=body,
                headers={"X-API-Key": settings.AGENTS_API_KEY},
            )
            resp.raise_for_status()
            return resp.json()
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error("Agent service unavailable: %s", e)
            raise HTTPException(status_code=503, detail="Agent service unavailable")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)

    async def proxy_put(self, path: str, body: dict) -> dict:
        """PUT proxy to TaskMeAgents with admin key."""
        try:
            resp = await self._client.put(
                path,
                json=body,
                headers={"X-API-Key": settings.AGENTS_API_KEY},
            )
            resp.raise_for_status()
            return resp.json()
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error("Agent service unavailable: %s", e)
            raise HTTPException(status_code=503, detail="Agent service unavailable")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)

    async def proxy_delete(self, path: str) -> int:
        """DELETE proxy to TaskMeAgents with admin key. Returns status code."""
        try:
            resp = await self._client.delete(
                path,
                headers={"X-API-Key": settings.AGENTS_API_KEY},
            )
            resp.raise_for_status()
            return resp.status_code
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.error("Agent service unavailable: %s", e)
            raise HTTPException(status_code=503, detail="Agent service unavailable")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)

    async def close(self):
        await self._client.aclose()


# Singleton
_bridge: Optional[AgentBridge] = None


def get_agent_bridge() -> AgentBridge:
    global _bridge
    if _bridge is None:
        _bridge = AgentBridge()
    return _bridge
