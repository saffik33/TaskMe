"""Tests for the NLP parse endpoint (LLM mocked)."""
from unittest.mock import patch


@patch("app.routers.parse.parse_natural_language")
def test_parse_empty_text_400(mock_llm, client, user_a):
    resp = client.post("/api/v1/parse", json={"text": "   "}, headers=user_a["headers"])
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()
    mock_llm.assert_not_called()


@patch("app.routers.parse.parse_natural_language")
def test_parse_success_mocked(mock_llm, client, user_a):
    mock_llm.return_value = [{"task_name": "Buy milk", "priority": "Low"}]
    resp = client.post("/api/v1/parse", json={"text": "Buy milk"}, headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["tasks"][0]["task_name"] == "Buy milk"


@patch("app.routers.parse.parse_natural_language")
def test_parse_llm_failure_500(mock_llm, client, user_a):
    mock_llm.side_effect = Exception("LLM down")
    resp = client.post("/api/v1/parse", json={"text": "Do something"}, headers=user_a["headers"])
    assert resp.status_code == 500
    assert "LLM parsing failed" in resp.json()["detail"]


def test_parse_requires_auth(client):
    resp = client.post("/api/v1/parse", json={"text": "Hello"})
    assert resp.status_code in (401, 403)


@patch("app.routers.parse.parse_natural_language")
def test_parse_with_workspace_id(mock_llm, client, user_a):
    mock_llm.return_value = [{"task_name": "Test"}]
    ws_id = user_a["workspace"].id
    resp = client.post("/api/v1/parse",
                       json={"text": "Test task", "workspace_id": ws_id},
                       headers=user_a["headers"])
    assert resp.status_code == 200
