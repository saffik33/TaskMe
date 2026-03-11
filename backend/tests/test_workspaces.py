"""P1 — Workspace CRUD tests."""
from tests.conftest import _create_workspace


def test_workspace_role_enum_values():
    from app.models.workspace import WorkspaceRole
    assert WorkspaceRole.OWNER == "owner"
    assert WorkspaceRole.EDITOR == "editor"
    assert WorkspaceRole.VIEWER == "viewer"


def test_workspace_member_has_status_and_inviter(session):
    from app.models.workspace import WorkspaceMember
    member = WorkspaceMember(workspace_id=1, user_id=1, role="owner")
    assert member.status == "accepted"
    assert member.inviter_id is None


def test_create_workspace(client, user_a):
    resp = client.post("/api/v1/workspaces",
                       json={"name": "New WS"},
                       headers=user_a["headers"])
    assert resp.status_code == 201
    assert resp.json()["name"] == "New WS"


def test_create_second_workspace(client, user_a):
    """Regression: constraint fix allows multiple workspaces per user."""
    resp1 = client.post("/api/v1/workspaces", json={"name": "WS1"}, headers=user_a["headers"])
    resp2 = client.post("/api/v1/workspaces", json={"name": "WS2"}, headers=user_a["headers"])
    assert resp1.status_code == 201
    assert resp2.status_code == 201


def test_list_workspaces(client, user_a):
    resp = client.get("/api/v1/workspaces", headers=user_a["headers"])
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_update_workspace(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.patch(f"/api/v1/workspaces/{ws_id}",
                        json={"name": "Renamed"},
                        headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"


def test_delete_workspace(client, session, user_a):
    # Create a second workspace so we can delete the first
    _create_workspace(session, user_a["user"], "Extra WS")
    ws_id = user_a["workspace"].id
    resp = client.delete(f"/api/v1/workspaces/{ws_id}", headers=user_a["headers"])
    assert resp.status_code == 200


def test_cannot_delete_only_workspace(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.delete(f"/api/v1/workspaces/{ws_id}", headers=user_a["headers"])
    assert resp.status_code == 400


def test_get_single_workspace(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.get(f"/api/v1/workspaces/{ws_id}", headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["name"] == "Alice Workspace"


def test_get_nonexistent_workspace(client, user_a):
    resp = client.get("/api/v1/workspaces/99999", headers=user_a["headers"])
    assert resp.status_code == 404


def test_workspace_columns_seeded_on_create(client, user_a):
    resp = client.post("/api/v1/workspaces", json={"name": "Seeded WS"}, headers=user_a["headers"])
    assert resp.status_code == 201
    ws_id = resp.json()["id"]

    cols = client.get(f"/api/v1/columns?workspace_id={ws_id}", headers=user_a["headers"])
    assert cols.status_code == 200
    assert len(cols.json()) == 8
