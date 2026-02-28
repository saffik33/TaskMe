from fastapi import APIRouter, HTTPException, Request, status
from sqlmodel import select

from ..auth import create_access_token, hash_password, verify_password
from ..database import SessionDep, seed_core_columns_for_user
from ..dependencies import CurrentUserDep
from ..models.user import User, UserCreate, UserLogin, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


def _validate_password_complexity(password: str) -> str | None:
    """Return an error message if password doesn't meet complexity requirements, else None."""
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one digit"
    return None


@router.post("/register", response_model=UserPublic, status_code=201)
def register(user_in: UserCreate, session: SessionDep):
    password_error = _validate_password_complexity(user_in.password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    existing = session.exec(select(User).where(User.username == user_in.username)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    existing_email = session.exec(select(User).where(User.email == user_in.email)).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    seed_core_columns_for_user(session, user.id)

    return user


@router.post("/login")
def login(credentials: UserLogin, session: SessionDep):
    user = session.exec(select(User).where(User.username == credentials.username)).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
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
