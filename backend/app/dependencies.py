from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlmodel import select

from .auth import decode_access_token
from .database import SessionDep
from .models.user import User

security_scheme = HTTPBearer()


def get_current_user(
    session: SessionDep,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def get_workspace_member(workspace_id: int, session: SessionDep, current_user: CurrentUserDep):
    """Return the WorkspaceMember for the current user in the given workspace, or 404."""
    from .models.workspace import WorkspaceMember
    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.status == "accepted",
        )
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return member


def require_editor(workspace_id: int, session: SessionDep, current_user: CurrentUserDep):
    """Return WorkspaceMember if user is editor+, otherwise 403."""
    member = get_workspace_member(workspace_id, session, current_user)
    if member.role == "viewer":
        raise HTTPException(status_code=403, detail="Editor access required")
    return member


def require_owner(workspace_id: int, session: SessionDep, current_user: CurrentUserDep):
    """Return WorkspaceMember if user is owner, otherwise 403."""
    member = get_workspace_member(workspace_id, session, current_user)
    if member.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return member
