"""P2 — Column Config tests."""


def test_list_columns_by_workspace(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.get(f"/api/v1/columns?workspace_id={ws_id}", headers=user_a["headers"])
    assert resp.status_code == 200
    # Core columns should be seeded (8 total)
    assert len(resp.json()) == 8


def test_create_custom_column(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                       json={"display_name": "Sprint", "field_type": "text"},
                       headers=user_a["headers"])
    assert resp.status_code == 201
    data = resp.json()
    assert data["field_key"].startswith("cf_")
    assert data["is_core"] is False


def test_duplicate_column_name_gets_suffix(client, user_a):
    ws_id = user_a["workspace"].id
    resp1 = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                        json={"display_name": "MyCol", "field_type": "text"},
                        headers=user_a["headers"])
    resp2 = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                        json={"display_name": "MyCol", "field_type": "text"},
                        headers=user_a["headers"])
    assert resp1.status_code == 201
    assert resp2.status_code == 201
    assert resp1.json()["field_key"] != resp2.json()["field_key"]


def test_reorder_columns(client, user_a):
    ws_id = user_a["workspace"].id
    cols = client.get(f"/api/v1/columns?workspace_id={ws_id}", headers=user_a["headers"]).json()

    reorder = [{"id": cols[0]["id"], "position": 5}, {"id": cols[1]["id"], "position": 0}]
    resp = client.patch(f"/api/v1/columns/reorder?workspace_id={ws_id}",
                        json=reorder, headers=user_a["headers"])
    assert resp.status_code == 200


def test_delete_custom_column(client, user_a):
    ws_id = user_a["workspace"].id
    create_resp = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                              json={"display_name": "Temp", "field_type": "text"},
                              headers=user_a["headers"])
    col_id = create_resp.json()["id"]

    resp = client.delete(f"/api/v1/columns/{col_id}", headers=user_a["headers"])
    assert resp.status_code == 200


def test_cannot_delete_core_column(client, user_a):
    ws_id = user_a["workspace"].id
    cols = client.get(f"/api/v1/columns?workspace_id={ws_id}", headers=user_a["headers"]).json()
    core = next(c for c in cols if c["is_core"])

    resp = client.delete(f"/api/v1/columns/{core['id']}", headers=user_a["headers"])
    assert resp.status_code == 400


def test_toggle_column_visibility(client, user_a):
    ws_id = user_a["workspace"].id
    # Create a custom column (not protected)
    create_resp = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                              json={"display_name": "Toggle Me", "field_type": "text"},
                              headers=user_a["headers"])
    col_id = create_resp.json()["id"]

    resp = client.patch(f"/api/v1/columns/{col_id}",
                        json={"is_visible": False},
                        headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["is_visible"] is False


def test_create_select_column_with_options(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                       json={"display_name": "Env", "field_type": "select",
                             "options": '["Dev","Staging","Prod"]'},
                       headers=user_a["headers"])
    assert resp.status_code == 201
    assert resp.json()["field_type"] == "select"
    assert resp.json()["options"] is not None


def test_create_column_invalid_field_type(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                       json={"display_name": "Bad", "field_type": "invalid"},
                       headers=user_a["headers"])
    assert resp.status_code == 400


def test_cannot_hide_protected_column(client, user_a):
    ws_id = user_a["workspace"].id
    cols = client.get(f"/api/v1/columns?workspace_id={ws_id}", headers=user_a["headers"]).json()
    status_col = next(c for c in cols if c["field_key"] == "status")

    resp = client.patch(f"/api/v1/columns/{status_col['id']}",
                        json={"is_visible": False},
                        headers=user_a["headers"])
    assert resp.status_code == 400


def test_select_column_requires_options(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                       json={"display_name": "NoOpts", "field_type": "select"},
                       headers=user_a["headers"])
    assert resp.status_code == 400


def test_update_column_display_name(client, user_a):
    ws_id = user_a["workspace"].id
    col = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                      json={"display_name": "Old Name", "field_type": "text"},
                      headers=user_a["headers"]).json()

    resp = client.patch(f"/api/v1/columns/{col['id']}",
                        json={"display_name": "New Name"},
                        headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "New Name"


def test_update_select_column_options(client, user_a):
    ws_id = user_a["workspace"].id
    col = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                      json={"display_name": "Priority2", "field_type": "select",
                            "options": '["A","B"]'},
                      headers=user_a["headers"]).json()

    resp = client.patch(f"/api/v1/columns/{col['id']}",
                        json={"options": '["X","Y","Z"]'},
                        headers=user_a["headers"])
    assert resp.status_code == 200
    assert '"Z"' in resp.json()["options"]


def test_update_select_column_invalid_options(client, user_a):
    ws_id = user_a["workspace"].id
    col = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                      json={"display_name": "Sel", "field_type": "select",
                            "options": '["A"]'},
                      headers=user_a["headers"]).json()

    resp = client.patch(f"/api/v1/columns/{col['id']}",
                        json={"options": "not-json"},
                        headers=user_a["headers"])
    assert resp.status_code == 400


def test_delete_column_not_owned(client, user_a, user_b):
    ws_id = user_b["workspace"].id
    col = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                      json={"display_name": "BobCol", "field_type": "text"},
                      headers=user_b["headers"]).json()

    resp = client.delete(f"/api/v1/columns/{col['id']}", headers=user_a["headers"])
    assert resp.status_code == 404


def test_update_column_not_owned(client, user_a, user_b):
    ws_id = user_b["workspace"].id
    col = client.post(f"/api/v1/columns?workspace_id={ws_id}",
                      json={"display_name": "BobCol2", "field_type": "text"},
                      headers=user_b["headers"]).json()

    resp = client.patch(f"/api/v1/columns/{col['id']}",
                        json={"display_name": "Hacked"},
                        headers=user_a["headers"])
    assert resp.status_code == 404
