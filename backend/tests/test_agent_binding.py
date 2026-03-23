"""Tests for agent binding endpoints."""

from unittest.mock import AsyncMock, patch

from app.models.task import Task
from tests.conftest import _add_member, _auth_headers, _create_user, _create_workspace


def _create_task(session, workspace, user, **kwargs):
    task = Task(
        task_name=kwargs.get("task_name", "Test Task"),
        workspace_id=workspace.id,
        user_id=user.id,
        status="To Do",
        priority="Medium",
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


class TestAgentTemplates:
    @patch("app.routers.agents.get_agent_bridge")
    def test_list_templates(self, mock_bridge, client, user_a):
        bridge = mock_bridge.return_value
        bridge.list_agent_templates = AsyncMock(return_value=[
            {"agent_id": "task-copilot", "name": "Task Co-Pilot"},
        ])
        resp = client.get("/api/v1/agents/templates", headers=user_a["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["agent_id"] == "task-copilot"

    @patch("app.routers.agents.get_agent_bridge")
    def test_agent_health(self, mock_bridge, client, user_a):
        bridge = mock_bridge.return_value
        bridge.is_available = AsyncMock(return_value=True)
        resp = client.get("/api/v1/agents/health", headers=user_a["headers"])
        assert resp.status_code == 200
        assert resp.json()["available"] is True

    def test_templates_requires_auth(self, client):
        resp = client.get("/api/v1/agents/templates")
        assert resp.status_code == 401


class TestAgentBind:
    @patch("app.routers.agents.get_agent_bridge")
    def test_bind_agent_to_task(self, mock_bridge, client, session, user_a):
        bridge = mock_bridge.return_value
        bridge.ensure_user_api_key = AsyncMock(return_value="tma_test_key")

        task = _create_task(session, user_a["workspace"], user_a["user"])
        resp = client.post(
            f"/api/v1/tasks/{task.id}/agent/bind?workspace_id={user_a['workspace'].id}",
            json={"agent_id": "task-copilot", "mode": "assistive"},
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent_id"] == "task-copilot"
        assert data["agent_mode"] == "assistive"
        assert data["agent_status"] == "idle"

    @patch("app.routers.agents.get_agent_bridge")
    def test_bind_invalid_mode(self, mock_bridge, client, session, user_a):
        bridge = mock_bridge.return_value
        bridge.ensure_user_api_key = AsyncMock(return_value="tma_test_key")

        task = _create_task(session, user_a["workspace"], user_a["user"])
        resp = client.post(
            f"/api/v1/tasks/{task.id}/agent/bind?workspace_id={user_a['workspace'].id}",
            json={"agent_id": "task-copilot", "mode": "invalid"},
            headers=user_a["headers"],
        )
        assert resp.status_code == 400

    @patch("app.routers.agents.get_agent_bridge")
    def test_bind_requires_editor(self, mock_bridge, client, session, user_a):
        """Viewer cannot bind agents."""
        viewer = _create_user(session, "viewer", "viewer@test.com")
        _add_member(session, user_a["workspace"], viewer, role="viewer")
        headers = _auth_headers(viewer)

        task = _create_task(session, user_a["workspace"], user_a["user"])
        resp = client.post(
            f"/api/v1/tasks/{task.id}/agent/bind?workspace_id={user_a['workspace'].id}",
            json={"agent_id": "task-copilot", "mode": "assistive"},
            headers=headers,
        )
        assert resp.status_code == 403

    def test_bind_task_not_found(self, client, user_a):
        resp = client.post(
            "/api/v1/tasks/99999/agent/bind?workspace_id=" + str(user_a["workspace"].id),
            json={"agent_id": "task-copilot", "mode": "assistive"},
            headers=user_a["headers"],
        )
        assert resp.status_code == 404


class TestAgentUnbind:
    @patch("app.routers.agents.get_agent_bridge")
    def test_unbind_agent(self, mock_bridge, client, session, user_a):
        bridge = mock_bridge.return_value
        bridge.ensure_user_api_key = AsyncMock(return_value="tma_test_key")

        task = _create_task(session, user_a["workspace"], user_a["user"])
        # Bind first
        client.post(
            f"/api/v1/tasks/{task.id}/agent/bind?workspace_id={user_a['workspace'].id}",
            json={"agent_id": "task-copilot", "mode": "assistive"},
            headers=user_a["headers"],
        )
        # Unbind
        resp = client.post(
            f"/api/v1/tasks/{task.id}/agent/unbind?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent_id"] is None
        assert data["agent_mode"] is None
        assert data["agent_status"] is None


class TestAgentStatus:
    @patch("app.routers.agents.get_agent_bridge")
    def test_get_status(self, mock_bridge, client, session, user_a):
        bridge = mock_bridge.return_value
        bridge.ensure_user_api_key = AsyncMock(return_value="tma_test_key")
        bridge.get_session = AsyncMock(return_value=None)

        task = _create_task(session, user_a["workspace"], user_a["user"])
        # Bind
        client.post(
            f"/api/v1/tasks/{task.id}/agent/bind?workspace_id={user_a['workspace'].id}",
            json={"agent_id": "task-copilot", "mode": "assistive"},
            headers=user_a["headers"],
        )
        # Check status
        resp = client.get(
            f"/api/v1/tasks/{task.id}/agent/status?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["agent_id"] == "task-copilot"
        assert data["agent_status"] == "idle"


class TestAgentMessages:
    @patch("app.routers.agents.get_agent_bridge")
    def test_no_session_returns_empty(self, mock_bridge, client, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"])
        resp = client.get(
            f"/api/v1/tasks/{task.id}/agent/messages?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        assert resp.json() == []


class TestAgentExecution:
    @patch("app.routers.agents.get_agent_bridge")
    def test_trigger_execution_success(self, mock_bridge, client, session, user_a):
        bridge = mock_bridge.return_value
        bridge.ensure_user_api_key = AsyncMock(return_value="tma_test_key")

        task = _create_task(session, user_a["workspace"], user_a["user"])
        task.agent_id = "task-copilot"
        task.agent_mode = "autonomous"
        task.agent_status = "idle"
        session.add(task)
        session.commit()

        resp = client.post(
            f"/api/v1/tasks/{task.id}/agent/execute?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "executing"

    def test_trigger_execution_no_agent(self, client, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"])
        resp = client.post(
            f"/api/v1/tasks/{task.id}/agent/execute?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 400
        assert "No agent bound" in resp.json()["detail"]

    @patch("app.routers.agents.get_agent_bridge")
    def test_trigger_execution_wrong_mode(self, mock_bridge, client, session, user_a):
        bridge = mock_bridge.return_value
        bridge.ensure_user_api_key = AsyncMock(return_value="tma_test_key")

        task = _create_task(session, user_a["workspace"], user_a["user"])
        task.agent_id = "task-copilot"
        task.agent_mode = "assistive"
        session.add(task)
        session.commit()

        resp = client.post(
            f"/api/v1/tasks/{task.id}/agent/execute?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 400
        assert "not in autonomous mode" in resp.json()["detail"]

    def test_trigger_execution_requires_editor(self, client, session, user_a):
        viewer = _create_user(session, "viewer2", "viewer2@test.com")
        _add_member(session, user_a["workspace"], viewer, role="viewer")
        headers = _auth_headers(viewer)

        task = _create_task(session, user_a["workspace"], user_a["user"])
        task.agent_id = "task-copilot"
        task.agent_mode = "autonomous"
        session.add(task)
        session.commit()

        resp = client.post(
            f"/api/v1/tasks/{task.id}/agent/execute?workspace_id={user_a['workspace'].id}",
            headers=headers,
        )
        assert resp.status_code == 403


class TestSubtasks:
    def test_list_subtasks(self, client, session, user_a):
        parent = _create_task(session, user_a["workspace"], user_a["user"], task_name="Parent")
        sub1 = Task(task_name="Sub 1", parent_task_id=parent.id, workspace_id=user_a["workspace"].id, user_id=user_a["user"].id, status="To Do", priority="Medium")
        sub2 = Task(task_name="Sub 2", parent_task_id=parent.id, workspace_id=user_a["workspace"].id, user_id=user_a["user"].id, status="To Do", priority="Medium")
        session.add_all([sub1, sub2])
        session.commit()

        resp = client.get(
            f"/api/v1/tasks/{parent.id}/subtasks?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        names = {d["task_name"] for d in data}
        assert names == {"Sub 1", "Sub 2"}

    def test_list_subtasks_empty(self, client, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"])
        resp = client.get(
            f"/api/v1/tasks/{task.id}/subtasks?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_subtasks_task_not_found(self, client, user_a):
        resp = client.get(
            f"/api/v1/tasks/99999/subtasks?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 404


class TestTaskPublicAgentFields:
    def test_task_list_includes_agent_fields(self, client, session, user_a):
        """Agent fields appear in task list response."""
        task = _create_task(session, user_a["workspace"], user_a["user"])
        task.agent_id = "task-copilot"
        task.agent_mode = "assistive"
        task.agent_status = "idle"
        session.add(task)
        session.commit()

        resp = client.get(
            f"/api/v1/tasks?workspace_id={user_a['workspace'].id}",
            headers=user_a["headers"],
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["agent_id"] == "task-copilot"
        assert data[0]["agent_mode"] == "assistive"
        assert data[0]["agent_status"] == "idle"
        assert data[0]["parent_task_id"] is None
