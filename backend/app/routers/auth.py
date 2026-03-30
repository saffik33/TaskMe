import asyncio
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import select

from sqlalchemy import func

from ..auth import create_access_token, hash_password, verify_password
from ..config import settings
from ..database import SessionDep, seed_core_columns_for_user
from ..dependencies import CurrentUserDep
from ..models.user import User, UserCreate, UserLogin, UserPublic
from ..services.email_service import send_verification_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _validate_password_complexity(password: str) -> str | None:
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one digit"
    return None


def _get_frontend_url() -> str:
    return os.getenv("FRONTEND_URL", settings.FRONTEND_URL)


def _accept_pending_invites(session, user):
    """Auto-accept any pending workspace invites for this user's email."""
    from ..models.workspace import WorkspaceMember, WorkspaceInvite
    from ..database import seed_core_columns_for_workspace

    try:
        invites = session.exec(
            select(WorkspaceInvite).where(
                func.lower(WorkspaceInvite.email) == func.lower(user.email)
            )
        ).all()
        for invite in invites:
            if invite.expires_at:
                exp = invite.expires_at if invite.expires_at.tzinfo else invite.expires_at.replace(tzinfo=timezone.utc)
                if exp < datetime.now(timezone.utc):
                    session.delete(invite)
                    session.commit()
                    continue

            existing = session.exec(
                select(WorkspaceMember).where(
                    WorkspaceMember.workspace_id == invite.workspace_id,
                    WorkspaceMember.user_id == user.id,
                )
            ).first()
            if existing:
                session.delete(invite)
                session.commit()
                continue

            ws_id = invite.workspace_id
            role = invite.role
            inviter = invite.inviter_id

            member = WorkspaceMember(
                workspace_id=ws_id,
                user_id=user.id,
                role=role,
                inviter_id=inviter,
            )
            session.add(member)
            session.delete(invite)
            session.commit()
            seed_core_columns_for_workspace(session, ws_id, user.id)
            logger.info("Auto-accepted invite: user %s added to workspace %d as %s", user.email, ws_id, role)
    except Exception as e:
        session.rollback()
        logger.error("Failed to process pending invites for %s: %s", user.email, e)


async def _send_verification(user: User):
    """Send verification email."""
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    verification_url = f"{backend_url}/api/v1/auth/verify-email?token={user.verification_token}"
    try:
        await send_verification_email(user.email, user.username, verification_url)
    except Exception as e:
        logger.error("Failed to send verification email to %s: %s", user.email, str(e))


@router.post("/register", status_code=201)
async def register(user_in: UserCreate, session: SessionDep):
    try:
        password_error = _validate_password_complexity(user_in.password)
        if password_error:
            raise HTTPException(status_code=400, detail=password_error)

        existing = session.exec(select(User).where(User.username == user_in.username)).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

        existing_email = session.exec(select(User).where(User.email == user_in.email)).first()
        if existing_email:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        token = secrets.token_urlsafe(32)
        user = User(
            username=user_in.username,
            email=user_in.email,
            hashed_password=hash_password(user_in.password),
            email_verified=False,
            verification_token=token,
            verification_token_expires=datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRY_HOURS),
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        seed_core_columns_for_user(session, user.id)

        await _send_verification(user)

        return {"message": "Registration successful. Please check your email to verify your account.", "email": user.email}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Register failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")


@router.get("/verify-email")
def verify_email(token: str, session: SessionDep):
    user = session.exec(select(User).where(User.verification_token == token)).first()
    if not user:
        return RedirectResponse(url=f"{_get_frontend_url()}/login?verified=invalid")

    if user.verification_token_expires:
        expires = user.verification_token_expires if user.verification_token_expires.tzinfo else user.verification_token_expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            return RedirectResponse(url=f"{_get_frontend_url()}/login?verified=expired")

    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    session.add(user)
    session.commit()

    return RedirectResponse(url=f"{_get_frontend_url()}/login?verified=success")


class ResendRequest(BaseModel):
    email: str


@router.post("/resend-verification")
async def resend_verification(req: ResendRequest, session: SessionDep):
    user = session.exec(select(User).where(User.email == req.email)).first()
    if not user:
        return {"message": "If that email exists, a verification link has been sent."}

    if user.email_verified:
        return {"message": "Email is already verified. You can log in."}

    user.verification_token = secrets.token_urlsafe(32)
    user.verification_token_expires = datetime.now(timezone.utc) + timedelta(hours=settings.EMAIL_VERIFICATION_EXPIRY_HOURS)
    session.add(user)
    session.commit()

    await _send_verification(user)

    return {"message": "If that email exists, a verification link has been sent."}


@router.post("/login")
def login(credentials: UserLogin, session: SessionDep):
    user = session.exec(select(User).where(User.username == credentials.username)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # OAuth-only user (no password set)
    if user.oauth_provider and not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This account uses {user.oauth_provider.title()} sign-in. Please use the '{user.oauth_provider.title()}' button.",
        )
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in. Check your inbox for the verification link.",
        )

    _accept_pending_invites(session, user)

    token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        },
    }


@router.get("/me", response_model=UserPublic)
def get_me(current_user: CurrentUserDep):
    return current_user


# --- Google OAuth ---

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/oauth/google/authorize")
def google_authorize():
    client_id = os.getenv("GOOGLE_CLIENT_ID", settings.GOOGLE_CLIENT_ID)
    if not client_id:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    redirect_uri = f"{backend_url}/api/v1/auth/oauth/google/callback"
    state = secrets.token_urlsafe(16)

    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&state={state}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return RedirectResponse(url=google_auth_url)


@router.get("/oauth/google/callback")
def google_callback(code: str, session: SessionDep, state: str = None):
    import httpx

    client_id = os.getenv("GOOGLE_CLIENT_ID", settings.GOOGLE_CLIENT_ID)
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", settings.GOOGLE_CLIENT_SECRET)
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    frontend_url = _get_frontend_url()
    redirect_uri = f"{backend_url}/api/v1/auth/oauth/google/callback"

    # Exchange code for tokens
    token_resp = httpx.post(GOOGLE_TOKEN_URL, data={
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    })
    if token_resp.status_code != 200:
        logger.error("Google token exchange failed with status %d", token_resp.status_code)
        return RedirectResponse(url=f"{frontend_url}/login?error=google_failed")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    # Fetch user info from Google
    userinfo_resp = httpx.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    if userinfo_resp.status_code != 200:
        logger.error("Google userinfo failed with status %d", userinfo_resp.status_code)
        return RedirectResponse(url=f"{frontend_url}/login?error=google_failed")

    google_user = userinfo_resp.json()
    google_email = google_user.get("email", "")
    google_name = google_user.get("name", "")

    if not google_email:
        return RedirectResponse(url=f"{frontend_url}/login?error=no_email")

    # Find or create user
    user = session.exec(select(User).where(User.email == google_email)).first()

    if not user:
        # Create new user from Google profile
        username = google_email.split("@")[0]
        # Ensure unique username
        base_username = username
        counter = 1
        while session.exec(select(User).where(User.username == username)).first():
            username = f"{base_username}{counter}"
            counter += 1

        user = User(
            username=username,
            email=google_email,
            hashed_password=None,
            oauth_provider="google",
            email_verified=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        # Create default workspace for new user
        from ..models.workspace import Workspace, WorkspaceMember
        from ..database import seed_core_columns_for_user, seed_core_columns_for_workspace

        seed_core_columns_for_user(session, user.id)

        ws = Workspace(name="My Tasks", owner_id=user.id)
        session.add(ws)
        session.commit()
        session.refresh(ws)

        member = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="owner")
        session.add(member)
        session.commit()

        seed_core_columns_for_workspace(session, ws.id, user.id)
    else:
        # Existing user — update oauth_provider if not set
        if not user.oauth_provider:
            user.oauth_provider = "google"
            user.email_verified = True
            session.add(user)
            session.commit()

    _accept_pending_invites(session, user)

    # Generate JWT token
    token = create_access_token(data={"sub": user.username, "user_id": user.id})

    # Redirect to frontend with token
    return RedirectResponse(url=f"{frontend_url}/login#token={token}")


# --- Microsoft OAuth ---

MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
MICROSOFT_USERINFO_URL = "https://graph.microsoft.com/v1.0/me"


@router.get("/oauth/microsoft/authorize")
def microsoft_authorize():
    client_id = os.getenv("MICROSOFT_CLIENT_ID", settings.MICROSOFT_CLIENT_ID)
    if not client_id:
        raise HTTPException(status_code=500, detail="Microsoft OAuth not configured")

    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    redirect_uri = f"{backend_url}/api/v1/auth/oauth/microsoft/callback"
    state = secrets.token_urlsafe(16)

    ms_auth_url = (
        f"{MICROSOFT_AUTH_URL}"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile%20User.Read"
        f"&state={state}"
        f"&response_mode=query"
    )
    return RedirectResponse(url=ms_auth_url)


@router.get("/oauth/microsoft/callback")
def microsoft_callback(code: str, session: SessionDep, state: str = None):
    import httpx

    client_id = os.getenv("MICROSOFT_CLIENT_ID", settings.MICROSOFT_CLIENT_ID)
    client_secret = os.getenv("MICROSOFT_CLIENT_SECRET", settings.MICROSOFT_CLIENT_SECRET)
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    frontend_url = _get_frontend_url()
    redirect_uri = f"{backend_url}/api/v1/auth/oauth/microsoft/callback"

    # Exchange code for tokens
    token_resp = httpx.post(MICROSOFT_TOKEN_URL, data={
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
        "scope": "openid email profile User.Read",
    })
    if token_resp.status_code != 200:
        logger.error("Microsoft token exchange failed with status %d", token_resp.status_code)
        return RedirectResponse(url=f"{frontend_url}/login?error=microsoft_failed")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    # Fetch user info from Microsoft Graph
    userinfo_resp = httpx.get(MICROSOFT_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    if userinfo_resp.status_code != 200:
        logger.error("Microsoft userinfo failed with status %d", userinfo_resp.status_code)
        return RedirectResponse(url=f"{frontend_url}/login?error=microsoft_failed")

    ms_user = userinfo_resp.json()
    ms_email = ms_user.get("mail") or ms_user.get("userPrincipalName", "")
    ms_name = ms_user.get("displayName", "")

    if not ms_email:
        return RedirectResponse(url=f"{frontend_url}/login?error=no_email")

    # Find or create user
    user = session.exec(select(User).where(User.email == ms_email)).first()

    if not user:
        # Create new user from Microsoft profile
        username = ms_email.split("@")[0]
        base_username = username
        counter = 1
        while session.exec(select(User).where(User.username == username)).first():
            username = f"{base_username}{counter}"
            counter += 1

        user = User(
            username=username,
            email=ms_email,
            hashed_password=None,
            oauth_provider="microsoft",
            email_verified=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        # Create default workspace for new user
        from ..models.workspace import Workspace, WorkspaceMember
        from ..database import seed_core_columns_for_user, seed_core_columns_for_workspace

        seed_core_columns_for_user(session, user.id)

        ws = Workspace(name="My Tasks", owner_id=user.id)
        session.add(ws)
        session.commit()
        session.refresh(ws)

        member = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="owner")
        session.add(member)
        session.commit()

        seed_core_columns_for_workspace(session, ws.id, user.id)
    else:
        # Existing user — update oauth_provider if not set
        if not user.oauth_provider:
            user.oauth_provider = "microsoft"
            user.email_verified = True
            session.add(user)
            session.commit()

    _accept_pending_invites(session, user)

    # Generate JWT token
    token = create_access_token(data={"sub": user.username, "user_id": user.id})

    # Redirect to frontend with token
    return RedirectResponse(url=f"{frontend_url}/login#token={token}")
