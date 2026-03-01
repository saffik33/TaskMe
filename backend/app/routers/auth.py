import asyncio
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import select

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


async def _send_verification(user: User):
    """Send verification email."""
    verification_url = f"{_get_frontend_url()}/verify-email?token={user.verification_token}"
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
def verify_email(token: str = Query(...), session: SessionDep = None):
    user = session.exec(select(User).where(User.verification_token == token)).first()
    if not user:
        return RedirectResponse(url=f"{_get_frontend_url()}/login?verified=invalid")

    if user.verification_token_expires and user.verification_token_expires < datetime.now(timezone.utc):
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
    if not user or not verify_password(credentials.password, user.hashed_password):
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
