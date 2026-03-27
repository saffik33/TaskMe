"""Tests for admin proxy router at /api/v1/admin/*."""

from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from tests.conftest import _auth_headers, _create_user


class TestAdminAuth:
    def test_admin_requires_auth(self, client):
        """No token -> 401."""
        resp = client.get("/api/v1/admin/agents")
        assert resp.status_code == 401

    def test_admin_requires_workspace_owner(self, client, session):
        """User with no workspace (not an owner) -> 403."""
        user = _create_user(session, "noworkspace", "noworkspace@test.com")
        headers = _auth_headers(user)
        resp = client.get("/api/v1/admin/agents", headers=headers)
        assert resp.status_code == 403


class TestAdminAgents:
    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_list_agents(self, mock_bridge_fn, client, user_a):
        bridge = AsyncMock()
        bridge.proxy_get = AsyncMock(return_value=[
            {"agent_id": "test", "name": "Test Agent"},
        ])
        mock_bridge_fn.return_value = bridge

        resp = client.get("/api/v1/admin/agents", headers=user_a["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["agent_id"] == "test"

    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_get_agent(self, mock_bridge_fn, client, user_a):
        bridge = AsyncMock()
        bridge.proxy_get = AsyncMock(return_value={"agent_id": "copilot", "name": "Co-Pilot"})
        mock_bridge_fn.return_value = bridge

        resp = client.get("/api/v1/admin/agents/copilot", headers=user_a["headers"])
        assert resp.status_code == 200
        assert resp.json()["agent_id"] == "copilot"

    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_create_agent(self, mock_bridge_fn, client, user_a):
        bridge = AsyncMock()
        bridge.proxy_post = AsyncMock(return_value={"agent_id": "new-agent", "name": "New Agent"})
        mock_bridge_fn.return_value = bridge

        resp = client.post(
            "/api/v1/admin/agents",
            json={"name": "New Agent", "model": "claude-3"},
            headers=user_a["headers"],
        )
        assert resp.status_code == 201
        assert resp.json()["agent_id"] == "new-agent"

    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_update_agent(self, mock_bridge_fn, client, user_a):
        bridge = AsyncMock()
        bridge.proxy_put = AsyncMock(return_value={"agent_id": "copilot", "name": "Updated"})
        mock_bridge_fn.return_value = bridge

        resp = client.put(
            "/api/v1/admin/agents/copilot",
            json={"name": "Updated"},
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated"

    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_delete_agent(self, mock_bridge_fn, client, user_a):
        bridge = AsyncMock()
        bridge.proxy_delete = AsyncMock(return_value=204)
        mock_bridge_fn.return_value = bridge

        resp = client.delete("/api/v1/admin/agents/copilot", headers=user_a["headers"])
        assert resp.status_code == 204


class TestAdminMCPAndModels:
    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_list_mcp_servers(self, mock_bridge_fn, client, user_a):
        bridge = AsyncMock()
        bridge.proxy_get = AsyncMock(return_value=[
            {"server_id": "s1", "name": "MCP Server 1"},
        ])
        mock_bridge_fn.return_value = bridge

        resp = client.get("/api/v1/admin/mcp-servers", headers=user_a["headers"])
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_list_models(self, mock_bridge_fn, client, user_a):
        bridge = AsyncMock()
        bridge.proxy_get = AsyncMock(return_value=[
            {"model_id": "claude-3", "name": "Claude 3"},
        ])
        mock_bridge_fn.return_value = bridge

        resp = client.get("/api/v1/admin/models", headers=user_a["headers"])
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestAdminSessions:
    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_list_sessions(self, mock_bridge_fn, client, user_a):
        bridge = AsyncMock()
        bridge.proxy_get = AsyncMock(return_value={
            "sessions": [{"session_id": "s1"}],
            "cursor": None,
        })
        mock_bridge_fn.return_value = bridge

        resp = client.get("/api/v1/admin/sessions", headers=user_a["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert "sessions" in data

    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_search_sessions(self, mock_bridge_fn, client, user_a):
        bridge = AsyncMock()
        bridge.proxy_get = AsyncMock(return_value=[
            {"session_id": "match-1", "agent_id": "copilot"},
        ])
        mock_bridge_fn.return_value = bridge

        resp = client.get(
            "/api/v1/admin/sessions/search?q=copilot",
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestAdminServiceError:
    @patch("app.routers.agent_admin.get_agent_bridge")
    def test_admin_service_unavailable(self, mock_bridge_fn, client, user_a):
        """Proxy raises HTTPException(503) when agent service is down."""
        bridge = AsyncMock()
        bridge.proxy_get = AsyncMock(side_effect=HTTPException(status_code=503, detail="Service unavailable"))
        mock_bridge_fn.return_value = bridge

        resp = client.get("/api/v1/admin/agents", headers=user_a["headers"])
        assert resp.status_code == 503
