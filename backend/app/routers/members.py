import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from ..database import SessionDep, seed_core_columns_for_workspace
from ..dependencies import CurrentUserDep, get_workspace_member, require_owner
from ..models.user import User
from ..models.workspace import WorkspaceMember, WorkspaceInvite, WorkspaceRole

logger = logging.getLogger(__name__)
router = APIRouter(tags=["members"])


class InviteRequest(BaseModel):
    email: str
    role: str = "editor"


class RoleChangeRequest(BaseModel):
    role: str


class MemberPublic(BaseModel):
    user_id: int
    username: str
    email: str
    role: str
    joined_at: Optional[str] = None


class InvitePublic(BaseModel):
    email: str
    role: str
    created_at: Optional[str] = None


@router.get("/workspaces/{workspace_id}/members")
def list_members(workspace_id: int, session: SessionDep, current_user: CurrentUserDep):
    get_workspace_member(workspace_id, session, current_user)
    memberships = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.status == "accepted",
        )
    ).all()
    members = []
    for m in memberships:
        user = session.get(User, m.user_id)
        if user:
            members.append({
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "role": m.role,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            })

    invites = session.exec(
        select(WorkspaceInvite).where(WorkspaceInvite.workspace_id == workspace_id)
    ).all()
    pending = [
        {"email": inv.email, "role": inv.role, "created_at": inv.created_at.isoformat() if inv.created_at else None}
        for inv in invites
    ]

    return {"members": members, "pending_invites": pending}


@router.post("/workspaces/{workspace_id}/invite")
async def invite_member(workspace_id: int, req: InviteRequest, session: SessionDep, current_user: CurrentUserDep):
    require_owner(workspace_id, session, current_user)

    # Validate role
    if req.role not in (WorkspaceRole.EDITOR, WorkspaceRole.VIEWER):
        raise HTTPException(status_code=400, detail="Role must be 'editor' or 'viewer'")

    # Cannot invite self
    if req.email == current_user.email:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    # Get workspace name for email
    from ..models.workspace import Workspace
    ws = session.get(Workspace, workspace_id)
    ws_name = ws.name if ws else "Unknown Workspace"

    # Check if already a member
    existing_user = session.exec(select(User).where(User.email == req.email)).first()
    if existing_user:
        existing_member = session.exec(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == existing_user.id,
            )
        ).first()
        if existing_member:
            raise HTTPException(status_code=409, detail="User is already a member")

        # Add as member immediately
        member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=existing_user.id,
            role=req.role,
            inviter_id=current_user.id,
        )
        session.add(member)
        session.commit()
        seed_core_columns_for_workspace(session, workspace_id, existing_user.id)

        # Send notification email to existing user
        try:
            from ..services.email_service import send_workspace_added_email
            await send_workspace_added_email(
                existing_user.email, existing_user.username,
                current_user.username, ws_name, req.role,
            )
        except Exception as e:
            print(f"ERROR: Failed to send workspace added email to {existing_user.email}: {e}")
            logger.error("Failed to send workspace added email to %s: %s", existing_user.email, str(e))
    else:
        # Check for existing invite
        existing_invite = session.exec(
            select(WorkspaceInvite).where(
                WorkspaceInvite.workspace_id == workspace_id,
                WorkspaceInvite.email == req.email,
            )
        ).first()
        if existing_invite:
            raise HTTPException(status_code=409, detail="Invite already sent to this email")

        invite = WorkspaceInvite(
            workspace_id=workspace_id,
            email=req.email,
            role=req.role,
            inviter_id=current_user.id,
        )
        session.add(invite)
        session.commit()

        # Send invite email to non-existing user
        try:
            import os
            from ..services.email_service import send_workspace_invite_email
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
            invite_url = f"{frontend_url}/login?invite={invite.token}"
            await send_workspace_invite_email(
                req.email, current_user.username, ws_name, req.role, invite_url,
            )
        except Exception as e:
            print(f"ERROR: Failed to send invite email to {req.email}: {e}")
            logger.error("Failed to send invite email to %s: %s", req.email, str(e))

    # Return same response regardless (email enumeration prevention)
    return {"message": "Invitation sent"}


@router.patch("/workspaces/{workspace_id}/members/{user_id}/role")
def change_member_role(workspace_id: int, user_id: int, req: RoleChangeRequest, session: SessionDep, current_user: CurrentUserDep):
    require_owner(workspace_id, session, current_user)

    if req.role not in (WorkspaceRole.EDITOR, WorkspaceRole.VIEWER):
        raise HTTPException(status_code=400, detail="Role must be 'editor' or 'viewer'")

    # Cannot change own role
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.role = req.role
    session.add(member)
    session.commit()
    return {"ok": True}


@router.delete("/workspaces/{workspace_id}/members/{user_id}")
def remove_member(workspace_id: int, user_id: int, session: SessionDep, current_user: CurrentUserDep):
    # Owner can remove anyone; members can only remove themselves (leave)
    is_self = user_id == current_user.id
    if not is_self:
        require_owner(workspace_id, session, current_user)

    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Last owner cannot leave
    if member.role == "owner":
        owners = session.exec(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.role == "owner",
            )
        ).all()
        if len(owners) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last owner")

    session.delete(member)
    session.commit()
    return {"ok": True}


@router.post("/invites/{token}/accept")
def accept_invite(token: str, session: SessionDep, current_user: CurrentUserDep):
    from datetime import datetime, timezone
    invite = session.exec(
        select(WorkspaceInvite).where(WorkspaceInvite.token == token)
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.expires_at:
        expires = invite.expires_at if invite.expires_at.tzinfo else invite.expires_at.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Invite has expired")

    # Check not already a member
    existing = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == invite.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    ).first()
    if existing:
        session.delete(invite)
        session.commit()
        return {"ok": True, "message": "Already a member"}

    member = WorkspaceMember(
        workspace_id=invite.workspace_id,
        user_id=current_user.id,
        role=invite.role,
        inviter_id=invite.inviter_id,
    )
    session.add(member)
    session.delete(invite)
    session.commit()
    seed_core_columns_for_workspace(session, invite.workspace_id, current_user.id)
    return {"ok": True}
