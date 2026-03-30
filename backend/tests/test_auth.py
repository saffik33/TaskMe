"""P0 — Auth & Security tests."""
from datetime import datetime, timezone

from sqlmodel import select

from tests.conftest import _create_user


def test_register_success(client):
    resp = client.post("/api/v1/auth/register", json={
        "username": "newuser",
        "email": "new@test.com",
        "password": "Test1234",
    })
    assert resp.status_code == 201
    assert "email" in resp.json()


def test_register_duplicate_username(client, session):
    _create_user(session, "taken", "taken@test.com")
    resp = client.post("/api/v1/auth/register", json={
        "username": "taken",
        "email": "other@test.com",
        "password": "Test1234",
    })
    assert resp.status_code == 409


def test_register_duplicate_email(client, session):
    _create_user(session, "user1", "dupe@test.com")
    resp = client.post("/api/v1/auth/register", json={
        "username": "user2",
        "email": "dupe@test.com",
        "password": "Test1234",
    })
    assert resp.status_code == 409


def test_register_weak_password(client):
    resp = client.post("/api/v1/auth/register", json={
        "username": "weakuser",
        "email": "weak@test.com",
        "password": "short",
    })
    assert resp.status_code in (400, 422)


def test_login_success(client, session):
    _create_user(session, "loginuser", "login@test.com", verified=True)
    resp = client.post("/api/v1/auth/login", json={
        "username": "loginuser",
        "password": "Test1234",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["username"] == "loginuser"


def test_login_wrong_password(client, session):
    _create_user(session, "loginuser", "login@test.com", verified=True)
    resp = client.post("/api/v1/auth/login", json={
        "username": "loginuser",
        "password": "WrongPass1",
    })
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post("/api/v1/auth/login", json={
        "username": "ghost",
        "password": "Test1234",
    })
    assert resp.status_code == 401


def test_unverified_user_cannot_login(client, session):
    _create_user(session, "unverified", "unv@test.com", verified=False)
    resp = client.post("/api/v1/auth/login", json={
        "username": "unverified",
        "password": "Test1234",
    })
    assert resp.status_code == 403


def test_get_me_authenticated(client, user_a):
    resp = client.get("/api/v1/auth/me", headers=user_a["headers"])
    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"


def test_get_me_no_token(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)


def test_get_me_invalid_token(client):
    resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalidtoken"})
    assert resp.status_code == 401


def test_register_missing_uppercase(client):
    resp = client.post("/api/v1/auth/register", json={
        "username": "nocase",
        "email": "nocase@test.com",
        "password": "alllower1",
    })
    assert resp.status_code == 400
    assert "uppercase" in resp.json()["detail"].lower()


def test_register_missing_digit(client):
    resp = client.post("/api/v1/auth/register", json={
        "username": "nodigit",
        "email": "nodigit@test.com",
        "password": "NoDigitHere",
    })
    assert resp.status_code == 400
    assert "digit" in resp.json()["detail"].lower()


def test_verify_email_success(client, session):
    user = _create_user(session, "verifyme", "verify@test.com", verified=False)
    user.verification_token = "test-verify-token"
    session.add(user)
    session.commit()

    resp = client.get("/api/v1/auth/verify-email?token=test-verify-token", follow_redirects=False)
    assert resp.status_code in (302, 307)
    assert "verified=success" in resp.headers.get("location", "")


def test_verify_email_invalid_token(client):
    resp = client.get("/api/v1/auth/verify-email?token=bogus", follow_redirects=False)
    assert resp.status_code in (302, 307)
    assert "verified=invalid" in resp.headers.get("location", "")


def test_resend_verification(client, session):
    user = _create_user(session, "resendme", "resend@test.com", verified=False)
    resp = client.post("/api/v1/auth/resend-verification", json={"email": "resend@test.com"})
    assert resp.status_code == 200


def test_resend_already_verified(client, session):
    _create_user(session, "verified", "ver@test.com", verified=True)
    resp = client.post("/api/v1/auth/resend-verification", json={"email": "ver@test.com"})
    assert resp.status_code == 200


def test_resend_nonexistent_email(client):
    resp = client.post("/api/v1/auth/resend-verification", json={"email": "nobody@test.com"})
    assert resp.status_code == 200  # Silent success to prevent email enumeration


def test_verify_expired_token(client, session):
    from datetime import datetime, timedelta, timezone
    user = _create_user(session, "expired", "exp@test.com", verified=False)
    user.verification_token = "expired-token"
    user.verification_token_expires = datetime.now(timezone.utc) - timedelta(hours=1)
    session.add(user)
    session.commit()

    resp = client.get("/api/v1/auth/verify-email?token=expired-token", follow_redirects=False)
    assert resp.status_code in (302, 307)
    location = resp.headers.get("location", "")
    assert "verified=expired" in location or "verified=invalid" in location


def test_login_oauth_only_user(client, session):
    from app.models.user import User
    user = User(username="guser", email="g@test.com", hashed_password=None,
                oauth_provider="google", email_verified=True)
    session.add(user)
    session.commit()

    resp = client.post("/api/v1/auth/login", json={
        "username": "guser",
        "password": "anything",
    })
    assert resp.status_code in (400, 401)


def test_login_microsoft_oauth_only_user(client, session):
    from app.models.user import User
    user = User(username="msuser", email="ms@test.com", hashed_password=None,
                oauth_provider="microsoft", email_verified=True)
    session.add(user)
    session.commit()

    resp = client.post("/api/v1/auth/login", json={
        "username": "msuser",
        "password": "anything",
    })
    assert resp.status_code in (400, 401)


def test_register_missing_lowercase(client):
    resp = client.post("/api/v1/auth/register", json={
        "username": "nocaps",
        "email": "nocaps@test.com",
        "password": "ALLUPPER1",
    })
    assert resp.status_code == 400
    assert "lowercase" in resp.json()["detail"].lower()


# --- Auto-accept pending invites on login ---

def test_login_auto_accepts_pending_invite(client, session):
    """User with a pending WorkspaceInvite should auto-join the workspace on login."""
    from app.models.workspace import Workspace, WorkspaceMember, WorkspaceInvite
    from app.database import seed_core_columns_for_workspace

    # Create inviter + workspace
    inviter = _create_user(session, "inviter", "inviter@test.com", verified=True)
    ws = Workspace(name="Team Workspace", owner_id=inviter.id)
    session.add(ws)
    session.commit()
    session.refresh(ws)
    member = WorkspaceMember(workspace_id=ws.id, user_id=inviter.id, role="owner")
    session.add(member)
    session.commit()

    # Create the invitee (registered, verified, but NOT a member of ws)
    invitee = _create_user(session, "invitee", "invitee@test.com", verified=True)

    # Create pending invite for invitee's email
    invite = WorkspaceInvite(
        workspace_id=ws.id,
        email="invitee@test.com",
        role="editor",
        inviter_id=inviter.id,
        token="auto-accept-token",
    )
    session.add(invite)
    session.commit()

    # Login as invitee
    resp = client.post("/api/v1/auth/login", json={
        "username": "invitee", "password": "Test1234",
    })
    assert resp.status_code == 200

    # Verify invitee is now a member of the workspace
    membership = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == ws.id,
            WorkspaceMember.user_id == invitee.id,
        )
    ).first()
    assert membership is not None
    assert membership.role == "editor"

    # Verify invite was deleted
    remaining = session.exec(
        select(WorkspaceInvite).where(WorkspaceInvite.token == "auto-accept-token")
    ).first()
    assert remaining is None


def test_login_skips_expired_invite(client, session):
    """Expired invites should be deleted but not create membership."""
    from datetime import timedelta
    from app.models.workspace import Workspace, WorkspaceMember, WorkspaceInvite

    inviter = _create_user(session, "inviter2", "inviter2@test.com", verified=True)
    ws = Workspace(name="Expired WS", owner_id=inviter.id)
    session.add(ws)
    session.commit()
    session.refresh(ws)
    session.add(WorkspaceMember(workspace_id=ws.id, user_id=inviter.id, role="owner"))
    session.commit()

    invitee = _create_user(session, "invitee2", "invitee2@test.com", verified=True)

    invite = WorkspaceInvite(
        workspace_id=ws.id,
        email="invitee2@test.com",
        role="editor",
        inviter_id=inviter.id,
        token="expired-auto-token",
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    session.add(invite)
    session.commit()

    resp = client.post("/api/v1/auth/login", json={
        "username": "invitee2", "password": "Test1234",
    })
    assert resp.status_code == 200

    # No membership created
    membership = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == ws.id,
            WorkspaceMember.user_id == invitee.id,
        )
    ).first()
    assert membership is None

    # Invite was cleaned up
    remaining = session.exec(
        select(WorkspaceInvite).where(WorkspaceInvite.token == "expired-auto-token")
    ).first()
    assert remaining is None


def test_login_cleans_up_duplicate_invite(client, session):
    """If user is already a member, pending invite should be deleted without error."""
    from app.models.workspace import Workspace, WorkspaceMember, WorkspaceInvite
    from app.database import seed_core_columns_for_workspace

    inviter = _create_user(session, "inviter3", "inviter3@test.com", verified=True)
    ws = Workspace(name="Dup WS", owner_id=inviter.id)
    session.add(ws)
    session.commit()
    session.refresh(ws)
    session.add(WorkspaceMember(workspace_id=ws.id, user_id=inviter.id, role="owner"))
    session.commit()

    invitee = _create_user(session, "invitee3", "invitee3@test.com", verified=True)

    # Add invitee as member first
    session.add(WorkspaceMember(workspace_id=ws.id, user_id=invitee.id, role="editor"))
    session.commit()

    # Create orphaned invite (shouldn't exist, but could from a race condition)
    invite = WorkspaceInvite(
        workspace_id=ws.id,
        email="invitee3@test.com",
        role="viewer",
        inviter_id=inviter.id,
        token="dup-token",
    )
    session.add(invite)
    session.commit()

    resp = client.post("/api/v1/auth/login", json={
        "username": "invitee3", "password": "Test1234",
    })
    assert resp.status_code == 200

    # Invite was cleaned up
    remaining = session.exec(
        select(WorkspaceInvite).where(WorkspaceInvite.token == "dup-token")
    ).first()
    assert remaining is None
