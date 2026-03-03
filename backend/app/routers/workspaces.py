from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from ..database import SessionDep, seed_core_columns_for_workspace
from ..dependencies import CurrentUserDep
from ..models.workspace import Workspace, WorkspaceMember, WorkspaceCreate, WorkspaceUpdate, WorkspacePublic

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspacePublic])
def list_workspaces(session: SessionDep, current_user: CurrentUserDep):
    memberships = session.exec(
        select(WorkspaceMember).where(WorkspaceMember.user_id == current_user.id)
    ).all()
    ws_ids = [m.workspace_id for m in memberships]
    if not ws_ids:
        return []
    workspaces = session.exec(
        select(Workspace).where(Workspace.id.in_(ws_ids)).order_by(Workspace.created_at)
    ).all()
    return workspaces


@router.post("", response_model=WorkspacePublic, status_code=201)
def create_workspace(ws_in: WorkspaceCreate, session: SessionDep, current_user: CurrentUserDep):
    ws = Workspace(
        name=ws_in.name,
        description=ws_in.description,
        owner_id=current_user.id,
    )
    session.add(ws)
    session.commit()
    session.refresh(ws)

    member = WorkspaceMember(workspace_id=ws.id, user_id=current_user.id, role="owner")
    session.add(member)
    session.commit()

    seed_core_columns_for_workspace(session, ws.id)

    return ws


@router.get("/{workspace_id}", response_model=WorkspacePublic)
def get_workspace(workspace_id: int, session: SessionDep, current_user: CurrentUserDep):
    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Workspace not found")

    ws = session.get(Workspace, workspace_id)
    return ws


@router.patch("/{workspace_id}", response_model=WorkspacePublic)
def update_workspace(workspace_id: int, ws_in: WorkspaceUpdate, session: SessionDep, current_user: CurrentUserDep):
    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Workspace not found")

    ws = session.get(Workspace, workspace_id)
    update_data = ws_in.model_dump(exclude_unset=True)
    ws.sqlmodel_update(update_data)
    session.add(ws)
    session.commit()
    session.refresh(ws)
    return ws


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: int, session: SessionDep, current_user: CurrentUserDep):
    from sqlalchemy import text

    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.role == "owner",
        )
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Only workspace owner can delete")

    # Check not deleting the only workspace
    all_memberships = session.exec(
        select(WorkspaceMember).where(WorkspaceMember.user_id == current_user.id)
    ).all()
    if len(all_memberships) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete your only workspace")

    # Delete all workspace data
    session.exec(text("DELETE FROM task WHERE workspace_id = :wid").bindparams(wid=workspace_id))
    session.exec(text("DELETE FROM columnconfig WHERE workspace_id = :wid").bindparams(wid=workspace_id))
    session.exec(text("DELETE FROM sharedlist WHERE workspace_id = :wid").bindparams(wid=workspace_id))
    session.exec(text("DELETE FROM workspacemember WHERE workspace_id = :wid").bindparams(wid=workspace_id))
    session.exec(text("DELETE FROM workspace WHERE id = :wid").bindparams(wid=workspace_id))
    session.commit()

    return {"ok": True}
