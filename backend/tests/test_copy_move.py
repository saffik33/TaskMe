"""P1 — Copy/Move Tasks tests."""
from tests.conftest import _create_workspace


def test_move_tasks_to_workspace(client, session, user_a):
    ws1 = user_a["workspace"]
    ws2 = _create_workspace(session, user_a["user"], "Destination")

    # Create tasks in ws1
    t1 = client.post(f"/api/v1/tasks?workspace_id={ws1.id}",
                     json={"task_name": "Move Me"}, headers=user_a["headers"]).json()

    resp = client.post("/api/v1/tasks/copy-move",
                       json={"task_ids": [t1["id"]], "destination_workspace_id": ws2.id, "action": "move"},
                       headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["action"] == "move"

    # Verify task is in ws2, not ws1
    ws1_tasks = client.get(f"/api/v1/tasks?workspace_id={ws1.id}", headers=user_a["headers"]).json()
    ws2_tasks = client.get(f"/api/v1/tasks?workspace_id={ws2.id}", headers=user_a["headers"]).json()
    assert len([t for t in ws1_tasks if t["task_name"] == "Move Me"]) == 0
    assert len([t for t in ws2_tasks if t["task_name"] == "Move Me"]) == 1


def test_copy_tasks_to_workspace(client, session, user_a):
    ws1 = user_a["workspace"]
    ws2 = _create_workspace(session, user_a["user"], "Copy Dest")

    t1 = client.post(f"/api/v1/tasks?workspace_id={ws1.id}",
                     json={"task_name": "Copy Me"}, headers=user_a["headers"]).json()

    resp = client.post("/api/v1/tasks/copy-move",
                       json={"task_ids": [t1["id"]], "destination_workspace_id": ws2.id, "action": "copy"},
                       headers=user_a["headers"])
    assert resp.status_code == 200

    # Both workspaces should have the task
    ws1_tasks = client.get(f"/api/v1/tasks?workspace_id={ws1.id}", headers=user_a["headers"]).json()
    ws2_tasks = client.get(f"/api/v1/tasks?workspace_id={ws2.id}", headers=user_a["headers"]).json()
    assert len([t for t in ws1_tasks if t["task_name"] == "Copy Me"]) == 1
    assert len([t for t in ws2_tasks if t["task_name"] == "Copy Me"]) == 1


def test_move_to_unauthorized_workspace(client, user_a, user_b):
    t1 = client.post(f"/api/v1/tasks?workspace_id={user_a['workspace'].id}",
                     json={"task_name": "Secret"}, headers=user_a["headers"]).json()

    resp = client.post("/api/v1/tasks/copy-move",
                       json={"task_ids": [t1["id"]], "destination_workspace_id": user_b["workspace"].id, "action": "move"},
                       headers=user_a["headers"])
    assert resp.status_code == 403
