"""P2 — Share & Export tests."""


def test_create_share_link(client, user_a):
    ws_id = user_a["workspace"].id
    task = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "Shared Task"}, headers=user_a["headers"]).json()

    resp = client.post("/api/v1/share",
                       json={"task_ids": [task["id"]], "workspace_id": ws_id},
                       headers=user_a["headers"])
    assert resp.status_code == 200
    assert "token" in resp.json()
    assert "url" in resp.json()


def test_shared_view_returns_tasks(client, user_a):
    ws_id = user_a["workspace"].id
    task = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "Viewable"}, headers=user_a["headers"]).json()

    share_resp = client.post("/api/v1/share",
                             json={"task_ids": [task["id"]]},
                             headers=user_a["headers"])
    token = share_resp.json()["token"]

    # Shared endpoint is public (no auth needed)
    resp = client.get(f"/api/v1/share/{token}")
    assert resp.status_code == 200
    names = [t["task_name"] for t in resp.json()]
    assert "Viewable" in names


def test_invalid_share_token(client):
    resp = client.get("/api/v1/share/nonexistent_token")
    assert resp.status_code == 404


def test_export_excel(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Export Me"}, headers=user_a["headers"])

    resp = client.get(f"/api/v1/export/excel?workspace_id={ws_id}", headers=user_a["headers"])
    assert resp.status_code == 200
    assert "spreadsheet" in resp.headers.get("content-type", "")


def test_expired_share_link(client, session, user_a):
    from datetime import datetime, timedelta, timezone
    from app.models.share import SharedList
    import json

    ws_id = user_a["workspace"].id
    task = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "Expired"}, headers=user_a["headers"]).json()

    # Create an expired share link directly in the DB
    shared = SharedList(
        share_token="expired-token",
        task_ids=json.dumps([task["id"]]),
        user_id=user_a["user"].id,
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    session.add(shared)
    session.commit()

    resp = client.get("/api/v1/share/expired-token")
    assert resp.status_code == 410


def test_share_other_users_tasks(client, user_a, user_b):
    ws_id = user_b["workspace"].id
    task = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "Bob Only"}, headers=user_b["headers"]).json()

    # Alice tries to share Bob's task
    resp = client.post("/api/v1/share",
                       json={"task_ids": [task["id"]]},
                       headers=user_a["headers"])
    assert resp.status_code == 403


def test_share_mixed_valid_invalid_ids(client, user_a):
    ws_id = user_a["workspace"].id
    task = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "Mine"}, headers=user_a["headers"]).json()

    resp = client.post("/api/v1/share",
                       json={"task_ids": [task["id"], 99999]},
                       headers=user_a["headers"])
    assert resp.status_code == 403
    assert "do not belong" in resp.json()["detail"].lower()


def test_export_with_workspace_filter(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "WS Export"}, headers=user_a["headers"])

    resp = client.get(f"/api/v1/export/excel?workspace_id={ws_id}", headers=user_a["headers"])
    assert resp.status_code == 200
    assert "spreadsheet" in resp.headers.get("content-type", "")


def test_export_with_ids_filter(client, user_a):
    ws_id = user_a["workspace"].id
    t1 = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                     json={"task_name": "T1"}, headers=user_a["headers"]).json()
    t2 = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                     json={"task_name": "T2"}, headers=user_a["headers"]).json()

    resp = client.get(f"/api/v1/export/excel?workspace_id={ws_id}&ids={t1['id']},{t2['id']}", headers=user_a["headers"])
    assert resp.status_code == 200


def test_send_share_email_success(client, user_a):
    from unittest.mock import AsyncMock, patch

    ws_id = user_a["workspace"].id
    task = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "Email Task"}, headers=user_a["headers"]).json()

    with patch("app.services.email_service.send_share_link_email", new_callable=AsyncMock) as mock_send:
        resp = client.post("/api/v1/share/send-email",
                           json={"share_url": "https://example.com/shared/abc",
                                 "recipient_email": "friend@test.com",
                                 "task_ids": [task["id"]],
                                 "workspace_id": ws_id},
                           headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["message"] == "Email sent successfully"
    mock_send.assert_called_once()


def test_non_member_cannot_export(client, user_a, user_b):
    ws_id = user_a["workspace"].id
    resp = client.get(f"/api/v1/export/excel?workspace_id={ws_id}", headers=user_b["headers"])
    assert resp.status_code == 404
