"""P0 — Data Isolation tests. Ensures users can't access each other's data."""
from app.models.task import Task
from tests.conftest import _add_member


def _create_task(session, user, workspace, name="Test Task"):
    task = Task(task_name=name, user_id=user.id, workspace_id=workspace.id)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def test_user_sees_only_own_workspace_tasks(client, session, user_a, user_b):
    _create_task(session, user_a["user"], user_a["workspace"], "Alice Task")
    _create_task(session, user_b["user"], user_b["workspace"], "Bob Task")

    resp = client.get("/api/v1/tasks",
                      params={"workspace_id": user_a["workspace"].id},
                      headers=user_a["headers"])
    assert resp.status_code == 200
    names = [t["task_name"] for t in resp.json()]
    assert "Alice Task" in names
    assert "Bob Task" not in names


def test_non_member_cannot_list_workspace_tasks(client, session, user_a, user_b):
    """User B cannot list tasks in User A's workspace."""
    _create_task(session, user_a["user"], user_a["workspace"], "Secret Task")

    resp = client.get("/api/v1/tasks",
                      params={"workspace_id": user_a["workspace"].id},
                      headers=user_b["headers"])
    assert resp.status_code == 404


def test_editor_can_see_workspace_tasks(client, session, user_a, user_b):
    """Editor in workspace can see all tasks."""
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    _create_task(session, user_a["user"], user_a["workspace"], "Owner Task")

    resp = client.get("/api/v1/tasks",
                      params={"workspace_id": user_a["workspace"].id},
                      headers=user_b["headers"])
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["task_name"] == "Owner Task"


def test_viewer_can_see_workspace_tasks(client, session, user_a, user_b):
    """Viewer can read tasks but not modify."""
    _add_member(session, user_a["workspace"], user_b["user"], "viewer")
    _create_task(session, user_a["user"], user_a["workspace"], "Visible Task")

    resp = client.get("/api/v1/tasks",
                      params={"workspace_id": user_a["workspace"].id},
                      headers=user_b["headers"])
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_user_sees_only_own_workspaces(client, user_a, user_b):
    resp = client.get("/api/v1/workspaces", headers=user_a["headers"])
    assert resp.status_code == 200
    names = [w["name"] for w in resp.json()]
    assert "Alice Workspace" in names
    assert "Bob Workspace" not in names


def test_user_cannot_modify_other_tasks(client, session, user_a, user_b):
    task = _create_task(session, user_b["user"], user_b["workspace"], "Bob Task")

    # Alice tries to update Bob's task (not a member of Bob's workspace)
    resp = client.patch(f"/api/v1/tasks/{task.id}",
                        json={"task_name": "Hacked"},
                        headers=user_a["headers"])
    assert resp.status_code == 404

    # Alice tries to delete Bob's task
    resp = client.delete(f"/api/v1/tasks/{task.id}", headers=user_a["headers"])
    assert resp.status_code == 404


def test_viewer_cannot_create_task(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "viewer")
    resp = client.post(f"/api/v1/tasks?workspace_id={user_a['workspace'].id}",
                       json={"task_name": "Blocked"},
                       headers=user_b["headers"])
    assert resp.status_code == 403


def test_editor_can_create_task(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.post(f"/api/v1/tasks?workspace_id={user_a['workspace'].id}",
                       json={"task_name": "Allowed"},
                       headers=user_b["headers"])
    assert resp.status_code == 201


def test_viewer_cannot_update_task(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "viewer")
    task = _create_task(session, user_a["user"], user_a["workspace"], "T")
    resp = client.patch(f"/api/v1/tasks/{task.id}",
                        json={"task_name": "Hacked"},
                        headers=user_b["headers"])
    assert resp.status_code == 403


def test_editor_can_update_task(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    task = _create_task(session, user_a["user"], user_a["workspace"], "T")
    resp = client.patch(f"/api/v1/tasks/{task.id}",
                        json={"task_name": "Updated by editor"},
                        headers=user_b["headers"])
    assert resp.status_code == 200
    assert resp.json()["task_name"] == "Updated by editor"


def test_viewer_cannot_delete_task(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "viewer")
    task = _create_task(session, user_a["user"], user_a["workspace"], "T")
    resp = client.delete(f"/api/v1/tasks/{task.id}", headers=user_b["headers"])
    assert resp.status_code == 403


def test_editor_can_delete_task(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    task = _create_task(session, user_a["user"], user_a["workspace"], "T")
    resp = client.delete(f"/api/v1/tasks/{task.id}", headers=user_b["headers"])
    assert resp.status_code == 200


def test_viewer_cannot_bulk_create(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "viewer")
    resp = client.post(f"/api/v1/tasks/bulk?workspace_id={user_a['workspace'].id}",
                       json=[{"task_name": "Blocked"}],
                       headers=user_b["headers"])
    assert resp.status_code == 403


def test_viewer_cannot_delete_all_tasks(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "viewer")
    resp = client.delete(f"/api/v1/tasks/all?workspace_id={user_a['workspace'].id}",
                         headers=user_b["headers"])
    assert resp.status_code == 403


def test_delete_all_requires_workspace_id(client, user_a):
    resp = client.delete("/api/v1/tasks/all", headers=user_a["headers"])
    assert resp.status_code == 422


def test_user_cannot_delete_other_workspace(client, user_a, user_b):
    resp = client.delete(f"/api/v1/workspaces/{user_b['workspace'].id}",
                         headers=user_a["headers"])
    assert resp.status_code in (403, 404)
