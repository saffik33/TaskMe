"""P1 — Task CRUD tests."""


def test_create_task(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "My Task", "status": "To Do", "priority": "Medium"},
                       headers=user_a["headers"])
    assert resp.status_code == 201
    assert resp.json()["task_name"] == "My Task"


def test_create_task_in_workspace(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "WS Task"},
                       headers=user_a["headers"])
    assert resp.status_code == 201
    # Verify it shows up in workspace-filtered list
    list_resp = client.get(f"/api/v1/tasks?workspace_id={ws_id}", headers=user_a["headers"])
    names = [t["task_name"] for t in list_resp.json()]
    assert "WS Task" in names


def test_list_tasks_by_workspace(client, user_a, session):
    from tests.conftest import _create_workspace
    ws1 = user_a["workspace"]
    ws2 = _create_workspace(session, user_a["user"], "WS2")

    client.post(f"/api/v1/tasks?workspace_id={ws1.id}",
                json={"task_name": "Task in WS1"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws2.id}",
                json={"task_name": "Task in WS2"}, headers=user_a["headers"])

    resp = client.get(f"/api/v1/tasks?workspace_id={ws1.id}", headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "Task in WS1" in names
    assert "Task in WS2" not in names


def test_list_tasks_with_status_filter(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Todo", "status": "To Do"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Done", "status": "Done"}, headers=user_a["headers"])

    resp = client.get(f"/api/v1/tasks?workspace_id={ws_id}&status=Done", headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "Done" in names
    assert "Todo" not in names


def test_list_tasks_with_search(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Deploy server"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Buy groceries"}, headers=user_a["headers"])

    resp = client.get(f"/api/v1/tasks?search=Deploy", headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "Deploy server" in names
    assert "Buy groceries" not in names


def test_list_tasks_sorting(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Alpha"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Zeta"}, headers=user_a["headers"])

    resp = client.get(f"/api/v1/tasks?sort_by=task_name&order=asc", headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert names == sorted(names)


def test_update_task(client, user_a):
    ws_id = user_a["workspace"].id
    create_resp = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                              json={"task_name": "Original"}, headers=user_a["headers"])
    task_id = create_resp.json()["id"]

    resp = client.patch(f"/api/v1/tasks/{task_id}",
                        json={"task_name": "Updated", "status": "Done"},
                        headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["task_name"] == "Updated"
    assert resp.json()["status"] == "Done"


def test_delete_task(client, user_a):
    ws_id = user_a["workspace"].id
    create_resp = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                              json={"task_name": "To Delete"}, headers=user_a["headers"])
    task_id = create_resp.json()["id"]

    resp = client.delete(f"/api/v1/tasks/{task_id}", headers=user_a["headers"])
    assert resp.status_code == 200

    get_resp = client.get(f"/api/v1/tasks/{task_id}", headers=user_a["headers"])
    assert get_resp.status_code == 404


def test_bulk_create_tasks(client, user_a):
    ws_id = user_a["workspace"].id
    resp = client.post(f"/api/v1/tasks/bulk?workspace_id={ws_id}",
                       json=[
                           {"task_name": "Bulk 1"},
                           {"task_name": "Bulk 2"},
                           {"task_name": "Bulk 3"},
                       ],
                       headers=user_a["headers"])
    assert resp.status_code == 201
    assert len(resp.json()) == 3


def test_delete_all_tasks(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "T1"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "T2"}, headers=user_a["headers"])

    resp = client.delete("/api/v1/tasks/all", headers=user_a["headers"])
    assert resp.status_code == 200

    list_resp = client.get("/api/v1/tasks", headers=user_a["headers"])
    assert len(list_resp.json()) == 0


def test_bulk_delete_tasks(client, user_a):
    ws_id = user_a["workspace"].id
    t1 = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                     json={"task_name": "Keep"}, headers=user_a["headers"]).json()
    t2 = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                     json={"task_name": "Delete1"}, headers=user_a["headers"]).json()
    t3 = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                     json={"task_name": "Delete2"}, headers=user_a["headers"]).json()

    resp = client.request("DELETE", "/api/v1/tasks/bulk/delete",
                          json=[t2["id"], t3["id"]], headers=user_a["headers"])
    assert resp.status_code == 200

    remaining = client.get(f"/api/v1/tasks?workspace_id={ws_id}", headers=user_a["headers"]).json()
    names = [t["task_name"] for t in remaining]
    assert "Keep" in names
    assert "Delete1" not in names
    assert "Delete2" not in names


def test_filter_by_priority(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Low Task", "priority": "Low"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "High Task", "priority": "High"}, headers=user_a["headers"])

    resp = client.get(f"/api/v1/tasks?priority=High", headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "High Task" in names
    assert "Low Task" not in names


def test_filter_by_owner(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Alice Task", "owner": "Alice"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Bob Task", "owner": "Bob"}, headers=user_a["headers"])

    resp = client.get(f"/api/v1/tasks?owner=Alice", headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "Alice Task" in names
    assert "Bob Task" not in names


def test_pagination_offset_limit(client, user_a):
    ws_id = user_a["workspace"].id
    for i in range(5):
        client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                    json={"task_name": f"Task {i}"}, headers=user_a["headers"])

    resp = client.get(f"/api/v1/tasks?limit=2&offset=0", headers=user_a["headers"])
    assert len(resp.json()) == 2

    resp2 = client.get(f"/api/v1/tasks?limit=2&offset=2", headers=user_a["headers"])
    assert len(resp2.json()) == 2
    # Make sure different tasks returned
    ids1 = {t["id"] for t in resp.json()}
    ids2 = {t["id"] for t in resp2.json()}
    assert ids1.isdisjoint(ids2)


def test_update_custom_fields_merge(client, user_a):
    import json
    ws_id = user_a["workspace"].id
    task = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "CF Task", "custom_fields": json.dumps({"field_a": "val_a"})},
                       headers=user_a["headers"]).json()

    # Update with a new field — should merge, not replace
    resp = client.patch(f"/api/v1/tasks/{task['id']}",
                        json={"custom_fields": json.dumps({"field_b": "val_b"})},
                        headers=user_a["headers"])
    assert resp.status_code == 200
    cf = json.loads(resp.json()["custom_fields"])
    assert cf["field_a"] == "val_a"
    assert cf["field_b"] == "val_b"


def test_get_task_by_id(client, user_a):
    ws_id = user_a["workspace"].id
    task = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "Fetched"}, headers=user_a["headers"]).json()
    resp = client.get(f"/api/v1/tasks/{task['id']}", headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["task_name"] == "Fetched"


def test_get_task_not_found(client, user_a):
    resp = client.get("/api/v1/tasks/99999", headers=user_a["headers"])
    assert resp.status_code == 404


def test_get_task_isolation(client, user_a, user_b):
    ws_id = user_b["workspace"].id
    task = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                       json={"task_name": "Bob Only"}, headers=user_b["headers"]).json()
    resp = client.get(f"/api/v1/tasks/{task['id']}", headers=user_a["headers"])
    assert resp.status_code == 404


def test_sort_by_invalid_falls_back(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "T1"}, headers=user_a["headers"])
    resp = client.get("/api/v1/tasks?sort_by=nonexistent&order=desc", headers=user_a["headers"])
    assert resp.status_code == 200


def test_combined_filters(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Deploy API", "status": "To Do", "priority": "High"},
                headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Deploy UI", "status": "Done", "priority": "High"},
                headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Fix Bug", "status": "To Do", "priority": "Low"},
                headers=user_a["headers"])

    resp = client.get("/api/v1/tasks?status=To Do&priority=High&search=Deploy",
                      headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "Deploy API" in names
    assert "Deploy UI" not in names
    assert "Fix Bug" not in names


def test_bulk_delete_with_nonexistent_ids(client, user_a):
    ws_id = user_a["workspace"].id
    t = client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                    json={"task_name": "Real"}, headers=user_a["headers"]).json()
    resp = client.request("DELETE", "/api/v1/tasks/bulk/delete",
                          json=[t["id"], 99999], headers=user_a["headers"])
    assert resp.status_code == 200


def test_bulk_delete_empty_list(client, user_a):
    resp = client.request("DELETE", "/api/v1/tasks/bulk/delete",
                          json=[], headers=user_a["headers"])
    assert resp.status_code == 200


def test_create_task_without_workspace(client, user_a):
    resp = client.post("/api/v1/tasks",
                       json={"task_name": "No Workspace"},
                       headers=user_a["headers"])
    assert resp.status_code == 201
    assert resp.json()["task_name"] == "No Workspace"


# --- Phase 1: Enhanced search tests ---


def test_search_case_insensitive(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Deploy Server"}, headers=user_a["headers"])
    # Search lowercase should find uppercase
    resp = client.get("/api/v1/tasks?search=deploy", headers=user_a["headers"])
    assert resp.status_code == 200
    names = [t["task_name"] for t in resp.json()]
    assert "Deploy Server" in names


def test_search_by_owner(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Task A", "owner": "Alice Johnson"},
                headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Task B", "owner": "Bob Smith"},
                headers=user_a["headers"])
    resp = client.get("/api/v1/tasks?search=alice", headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "Task A" in names
    assert "Task B" not in names


def test_search_by_email(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Email Task", "email": "jane@example.com"},
                headers=user_a["headers"])
    resp = client.get("/api/v1/tasks?search=jane@example", headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "Email Task" in names


def test_filter_multi_status(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "T1", "status": "To Do"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "T2", "status": "In Progress"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "T3", "status": "Done"}, headers=user_a["headers"])
    resp = client.get(f"/api/v1/tasks?workspace_id={ws_id}&statuses=To Do,In Progress",
                      headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "T1" in names
    assert "T2" in names
    assert "T3" not in names


def test_filter_multi_priority(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "P1", "priority": "High"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "P2", "priority": "Critical"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "P3", "priority": "Low"}, headers=user_a["headers"])
    resp = client.get(f"/api/v1/tasks?workspace_id={ws_id}&priorities=High,Critical",
                      headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "P1" in names
    assert "P2" in names
    assert "P3" not in names


def test_filter_date_range(client, user_a):
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Early", "due_date": "2026-01-10"},
                headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Middle", "due_date": "2026-03-15"},
                headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Late", "due_date": "2026-06-20"},
                headers=user_a["headers"])
    resp = client.get(f"/api/v1/tasks?workspace_id={ws_id}&date_from=2026-03-01&date_to=2026-04-01",
                      headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "Middle" in names
    assert "Early" not in names
    assert "Late" not in names


def test_filter_invalid_status_returns_400(client, user_a):
    resp = client.get("/api/v1/tasks?statuses=To Do,NotAStatus", headers=user_a["headers"])
    assert resp.status_code == 400
    assert "Invalid status" in resp.json()["detail"]


def test_filter_invalid_priority_returns_400(client, user_a):
    resp = client.get("/api/v1/tasks?priorities=High,Banana", headers=user_a["headers"])
    assert resp.status_code == 400
    assert "Invalid priority" in resp.json()["detail"]


def test_search_wildcards_are_escaped(client, user_a):
    """Verify that SQL wildcard characters in search are escaped, not treated as patterns."""
    ws_id = user_a["workspace"].id
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Abc"}, headers=user_a["headers"])
    client.post(f"/api/v1/tasks?workspace_id={ws_id}",
                json={"task_name": "Xyz"}, headers=user_a["headers"])
    # Search for "_" as literal — should NOT match every single-char position
    # With proper escaping, "%" in the pattern is literal, not a wildcard
    resp = client.get("/api/v1/tasks", params={"search": "Abc"}, headers=user_a["headers"])
    names = [t["task_name"] for t in resp.json()]
    assert "Abc" in names
    assert "Xyz" not in names


# --- Phase 2: Smart search (LLM mocked) ---

from unittest.mock import patch


@patch("app.services.llm_service.parse_search_query")
def test_smart_search_success(mock_llm, client, user_a):
    mock_llm.return_value = {
        "status": ["In Progress", "To Do"],
        "priority": ["Critical"],
    }
    resp = client.post("/api/v1/tasks/smart-search",
                       json={"query": "in progress and to do with critical priority"},
                       headers=user_a["headers"])
    assert resp.status_code == 200
    filters = resp.json()["filters"]
    assert "In Progress" in filters["status"]
    assert "To Do" in filters["status"]
    assert "Critical" in filters["priority"]


def test_smart_search_empty_query_400(client, user_a):
    resp = client.post("/api/v1/tasks/smart-search",
                       json={"query": "   "},
                       headers=user_a["headers"])
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


def test_smart_search_requires_auth(client):
    resp = client.post("/api/v1/tasks/smart-search",
                       json={"query": "show me tasks"})
    assert resp.status_code in (401, 403)


@patch("app.services.llm_service.parse_search_query")
def test_smart_search_llm_failure_500(mock_llm, client, user_a):
    mock_llm.side_effect = Exception("LLM down")
    resp = client.post("/api/v1/tasks/smart-search",
                       json={"query": "show me tasks"},
                       headers=user_a["headers"])
    assert resp.status_code == 500
    assert "Failed to parse" in resp.json()["detail"]
