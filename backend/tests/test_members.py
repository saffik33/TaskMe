"""Member management and invite flow tests."""
from datetime import datetime, timedelta, timezone

from app.models.workspace import WorkspaceInvite
from tests.conftest import _add_member


def test_list_members(client, user_a):
    resp = client.get(f"/api/v1/workspaces/{user_a['workspace'].id}/members",
                      headers=user_a["headers"])
    assert resp.status_code == 200
    assert len(resp.json()["members"]) == 1
    assert resp.json()["members"][0]["role"] == "owner"


def test_non_member_cannot_list_members(client, user_a, user_b):
    resp = client.get(f"/api/v1/workspaces/{user_a['workspace'].id}/members",
                      headers=user_b["headers"])
    assert resp.status_code == 404


def test_invite_existing_user(client, session, user_a, user_b):
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "bob@test.com", "role": "editor"},
                       headers=user_a["headers"])
    assert resp.status_code == 200

    # Verify bob is now a member
    members = client.get(f"/api/v1/workspaces/{user_a['workspace'].id}/members",
                         headers=user_a["headers"]).json()
    emails = [m["email"] for m in members["members"]]
    assert "bob@test.com" in emails


def test_invite_nonexistent_email(client, user_a, session):
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "nobody@test.com", "role": "viewer"},
                       headers=user_a["headers"])
    assert resp.status_code == 200  # same response (email enumeration prevention)

    # Verify invite was created
    members = client.get(f"/api/v1/workspaces/{user_a['workspace'].id}/members",
                         headers=user_a["headers"]).json()
    pending_emails = [p["email"] for p in members["pending_invites"]]
    assert "nobody@test.com" in pending_emails


def test_non_owner_cannot_invite(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "someone@test.com", "role": "viewer"},
                       headers=user_b["headers"])
    assert resp.status_code == 403


def test_cannot_invite_self(client, user_a):
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "alice@test.com", "role": "editor"},
                       headers=user_a["headers"])
    assert resp.status_code == 400


def test_cannot_invite_existing_member(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "bob@test.com", "role": "viewer"},
                       headers=user_a["headers"])
    assert resp.status_code == 409


def test_cannot_invite_with_owner_role(client, user_a):
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "someone@test.com", "role": "owner"},
                       headers=user_a["headers"])
    assert resp.status_code == 400


def test_change_member_role(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.patch(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_b['user'].id}/role",
        json={"role": "viewer"}, headers=user_a["headers"])
    assert resp.status_code == 200


def test_owner_cannot_demote_self(client, user_a):
    resp = client.patch(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_a['user'].id}/role",
        json={"role": "editor"}, headers=user_a["headers"])
    assert resp.status_code == 400


def test_remove_member(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.delete(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_b['user'].id}",
        headers=user_a["headers"])
    assert resp.status_code == 200


def test_member_can_leave(client, session, user_a, user_b):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.delete(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_b['user'].id}",
        headers=user_b["headers"])
    assert resp.status_code == 200


def test_last_owner_cannot_leave(client, user_a):
    resp = client.delete(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_a['user'].id}",
        headers=user_a["headers"])
    assert resp.status_code == 400


def test_accept_invite_token(client, session, user_a, user_b):
    invite = WorkspaceInvite(
        workspace_id=user_a["workspace"].id,
        email="bob@test.com", role="editor",
        inviter_id=user_a["user"].id,
        token="test-accept-token",
    )
    session.add(invite)
    session.commit()
    resp = client.post("/api/v1/invites/test-accept-token/accept",
                       headers=user_b["headers"])
    assert resp.status_code == 200


def test_expired_invite_token(client, session, user_a, user_b):
    invite = WorkspaceInvite(
        workspace_id=user_a["workspace"].id,
        email="bob@test.com", role="editor",
        inviter_id=user_a["user"].id,
        token="expired-token",
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    session.add(invite)
    session.commit()
    resp = client.post("/api/v1/invites/expired-token/accept",
                       headers=user_b["headers"])
    assert resp.status_code == 410


def test_cannot_accept_invite_for_different_email(client, session, user_a, user_c):
    """User C (charlie@test.com) cannot accept invite sent to bob@test.com."""
    invite = WorkspaceInvite(
        workspace_id=user_a["workspace"].id,
        email="bob@test.com", role="editor",
        inviter_id=user_a["user"].id,
        token="wrong-email-token",
    )
    session.add(invite)
    session.commit()
    resp = client.post("/api/v1/invites/wrong-email-token/accept",
                       headers=user_c["headers"])
    assert resp.status_code == 403
    assert "different email" in resp.json()["detail"].lower()


def test_pending_invites_include_id(client, session, user_a):
    """Pending invites response must include the invite id for cancel to work."""
    invite = WorkspaceInvite(
        workspace_id=user_a["workspace"].id,
        email="someone@test.com", role="viewer",
        inviter_id=user_a["user"].id,
        token="id-check-token",
    )
    session.add(invite)
    session.commit()

    resp = client.get(f"/api/v1/workspaces/{user_a['workspace'].id}/members",
                      headers=user_a["headers"])
    assert resp.status_code == 200
    pending = resp.json()["pending_invites"]
    assert len(pending) == 1
    assert "id" in pending[0]
    assert isinstance(pending[0]["id"], int)


def test_cancel_invite(client, session, user_a):
    """Owner can cancel a pending invite."""
    invite = WorkspaceInvite(
        workspace_id=user_a["workspace"].id,
        email="cancel-me@test.com", role="editor",
        inviter_id=user_a["user"].id,
        token="cancel-token",
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)

    resp = client.delete(
        f"/api/v1/workspaces/{user_a['workspace'].id}/invites/{invite.id}",
        headers=user_a["headers"])
    assert resp.status_code == 200

    # Verify invite is gone
    members = client.get(f"/api/v1/workspaces/{user_a['workspace'].id}/members",
                         headers=user_a["headers"]).json()
    assert len(members["pending_invites"]) == 0
