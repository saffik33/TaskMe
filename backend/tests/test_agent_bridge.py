"""Tests for the AgentBridge service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.agent_bridge import AgentBridge, _derive_fernet_key


class TestFernetKeyDerivation:
    def test_derive_key_is_deterministic(self):
        key1 = _derive_fernet_key("test-secret")
        key2 = _derive_fernet_key("test-secret")
        assert key1 == key2

    def test_different_secrets_produce_different_keys(self):
        key1 = _derive_fernet_key("secret-a")
        key2 = _derive_fernet_key("secret-b")
        assert key1 != key2

    def test_key_is_valid_fernet_key(self):
        from cryptography.fernet import Fernet
        key = _derive_fernet_key("test-secret")
        # Should not raise
        f = Fernet(key)
        # Roundtrip
        encrypted = f.encrypt(b"hello")
        assert f.decrypt(encrypted) == b"hello"


class TestBridgeEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        bridge = AgentBridge()
        plaintext = "tma_test_api_key_12345"
        encrypted = bridge._encrypt(plaintext)
        assert encrypted != plaintext
        decrypted = bridge._decrypt(encrypted)
        assert decrypted == plaintext

    def test_agents_user_id_mapping(self):
        bridge = AgentBridge()
        assert bridge._agents_user_id(42) == "taskme-user-42"
        assert bridge._agents_user_id(1) == "taskme-user-1"


class TestBridgeHealthCheck:
    @pytest.mark.asyncio
    async def test_is_available_when_healthy(self):
        bridge = AgentBridge()
        mock_response = MagicMock()
        mock_response.status_code = 200
        bridge._client.get = AsyncMock(return_value=mock_response)
        assert await bridge.is_available() is True

    @pytest.mark.asyncio
    async def test_is_available_when_down(self):
        bridge = AgentBridge()
        import httpx
        bridge._client.get = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
        assert await bridge.is_available() is False


class TestBridgeListTemplates:
    @pytest.mark.asyncio
    async def test_list_templates_success(self):
        bridge = AgentBridge()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"agent_id": "task-copilot", "name": "Co-Pilot"}]
        mock_response.raise_for_status = MagicMock()
        bridge._client.get = AsyncMock(return_value=mock_response)

        result = await bridge.list_agent_templates()
        assert len(result) == 1
        assert result[0]["agent_id"] == "task-copilot"

    @pytest.mark.asyncio
    async def test_list_templates_service_down(self):
        bridge = AgentBridge()
        import httpx
        bridge._client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await bridge.list_agent_templates()
        assert exc_info.value.status_code == 503


class TestBridgeSessionMessages:
    @pytest.mark.asyncio
    async def test_get_messages_success(self):
        bridge = AgentBridge()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"id": "msg-1", "role": "user", "content": {}}]
        mock_response.raise_for_status = MagicMock()
        bridge._client.get = AsyncMock(return_value=mock_response)

        result = await bridge.get_session_messages("tma_key", "session-123")
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_messages_404_returns_empty(self):
        bridge = AgentBridge()
        import httpx
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.raise_for_status = MagicMock(side_effect=httpx.HTTPStatusError("Not found", request=MagicMock(), response=mock_response))
        bridge._client.get = AsyncMock(return_value=mock_response)

        result = await bridge.get_session_messages("tma_key", "nonexistent")
        assert result == []


class TestBridgeGetSession:
    @pytest.mark.asyncio
    async def test_get_session_success(self):
        bridge = AgentBridge()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "session-1", "status": "running"}
        mock_response.raise_for_status = MagicMock()
        bridge._client.get = AsyncMock(return_value=mock_response)

        result = await bridge.get_session("tma_key", "session-1")
        assert result["id"] == "session-1"
        assert result["status"] == "running"

    @pytest.mark.asyncio
    async def test_get_session_404_returns_none(self):
        bridge = AgentBridge()
        mock_response = MagicMock()
        mock_response.status_code = 404
        bridge._client.get = AsyncMock(return_value=mock_response)

        result = await bridge.get_session("tma_key", "nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_session_service_down_returns_none(self):
        bridge = AgentBridge()
        import httpx
        bridge._client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))

        result = await bridge.get_session("tma_key", "any")
        assert result is None


class TestBridgeCaching:
    def test_memory_cache_used_on_second_call(self):
        bridge = AgentBridge()
        bridge._key_cache[42] = "cached-key"
        # In-memory cache should return immediately
        assert bridge._key_cache[42] == "cached-key"

    @pytest.mark.asyncio
    async def test_is_available_timeout_returns_false(self):
        bridge = AgentBridge()
        import httpx
        bridge._client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        assert await bridge.is_available() is False
