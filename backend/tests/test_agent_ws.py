"""Tests for WebSocket relay helper functions and connection auth."""

import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from starlette.websockets import WebSocketDisconnect

from app.models.task import Task
from app.routers.agent_ws import _build_task_context, _execute_local_tool, _save_session_id
from tests.conftest import _create_user, _create_workspace, _auth_headers, _add_member


def _create_task(session, workspace, user, **kwargs):
    task = Task(
        task_name=kwargs.get("task_name", "Test Task"),
        description=kwargs.get("description"),
        workspace_id=workspace.id,
        user_id=user.id,
        status=kwargs.get("status", "To Do"),
        priority=kwargs.get("priority", "Medium"),
        owner=kwargs.get("owner"),
        due_date=kwargs.get("due_date"),
        agent_id=kwargs.get("agent_id"),
        agent_mode=kwargs.get("agent_mode"),
        agent_status=kwargs.get("agent_status"),
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


class TestBuildTaskContext:
    def test_formats_all_fields(self):
        task = Task(
            task_name="Deploy v2",
            status="In Progress",
            priority="High",
            description="Deploy to production",
            due_date="2026-04-01",
            owner="Alice",
        )
        ctx = _build_task_context(task)
        assert "[Task Context]" in ctx
        assert "Name: Deploy v2" in ctx
        assert "Status: In Progress" in ctx
        assert "Priority: High" in ctx
        assert "Description: Deploy to production" in ctx
        assert "Due Date: 2026-04-01" in ctx
        assert "Owner: Alice" in ctx
        assert "---" in ctx

    def test_omits_missing_optional_fields(self):
        task = Task(task_name="Simple Task", status="To Do", priority="Low")
        ctx = _build_task_context(task)
        assert "Name: Simple Task" in ctx
        assert "Description:" not in ctx
        assert "Due Date:" not in ctx
        assert "Owner:" not in ctx


class TestExecuteLocalTool:
    """Tests for _execute_local_tool — need to patch engine to use test DB."""

    @pytest.mark.asyncio
    async def test_update_task_changes_fields(self, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"])
        with patch("app.routers.agent_ws.engine", session.get_bind()):
            result = await _execute_local_tool(task.id, "update_task", {"status": "Done", "priority": "Critical"})
        assert result["success"] is True
        session.expire(task)
        assert str(task.status) == "Done" or task.status.value == "Done"

    @pytest.mark.asyncio
    async def test_update_task_ignores_disallowed_fields(self, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"])
        original_name = task.task_name
        with patch("app.routers.agent_ws.engine", session.get_bind()):
            result = await _execute_local_tool(task.id, "update_task", {"task_name": "hacked", "status": "Done"})
        assert result["success"] is True
        session.expire(task)
        assert task.task_name == original_name  # not changed

    @pytest.mark.asyncio
    async def test_create_subtask(self, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"])
        with patch("app.routers.agent_ws.engine", session.get_bind()):
            result = await _execute_local_tool(task.id, "create_subtask", {
                "task_name": "Subtask 1",
                "priority": "High",
            })
        assert result["success"] is True
        assert "task_id" in result

    @pytest.mark.asyncio
    async def test_create_subtasks_batch(self, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"])
        with patch("app.routers.agent_ws.engine", session.get_bind()):
            result = await _execute_local_tool(task.id, "create_subtasks_batch", {
                "subtasks": [
                    {"task_name": "Sub A"},
                    {"task_name": "Sub B"},
                    {"task_name": "Sub C"},
                ]
            })
        assert result["success"] is True
        assert "Created 3 subtasks" in result["message"]

    @pytest.mark.asyncio
    async def test_unknown_tool_returns_error(self, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"])
        with patch("app.routers.agent_ws.engine", session.get_bind()):
            result = await _execute_local_tool(task.id, "nonexistent_tool", {})
        assert result["success"] is False
        assert "Unknown tool" in result["error"]

    @pytest.mark.asyncio
    async def test_task_not_found_returns_error(self, session):
        with patch("app.routers.agent_ws.engine", session.get_bind()):
            result = await _execute_local_tool(99999, "update_task", {"status": "Done"})
        assert result["success"] is False
        assert "not found" in result["error"]


class TestSaveSessionId:
    @pytest.mark.asyncio
    async def test_saves_session_id_to_task(self, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"], agent_id="task-copilot")
        assert task.agent_session_id is None
        with patch("app.routers.agent_ws.engine", session.get_bind()):
            await _save_session_id(task.id, "session-uuid-123")
        session.expire(task)
        assert task.agent_session_id == "session-uuid-123"


class TestWebSocketAuth:
    def test_ws_invalid_token_rejects(self, client, session, user_a):
        task = _create_task(session, user_a["workspace"], user_a["user"], agent_id="task-copilot")
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(
                f"/api/v1/ws/agent-chat?task_id={task.id}&token=invalid-jwt-token"
            ):
                pass
        assert exc_info.value.code == 4001

    def test_ws_task_not_found_rejects(self, client, session, user_a):
        from app.auth import create_access_token
        token = create_access_token(data={"sub": "alice", "user_id": user_a["user"].id})
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(
                f"/api/v1/ws/agent-chat?task_id=99999&token={token}"
            ):
                pass
        assert exc_info.value.code == 4004

    def test_ws_no_agent_bound_rejects(self, client, session, user_a):
        from app.auth import create_access_token
        task = _create_task(session, user_a["workspace"], user_a["user"])  # no agent_id
        token = create_access_token(data={"sub": "alice", "user_id": user_a["user"].id})
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(
                f"/api/v1/ws/agent-chat?task_id={task.id}&token={token}"
            ):
                pass
        assert exc_info.value.code == 4000
