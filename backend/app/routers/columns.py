import json
import re
from typing import Optional

from fastapi import APIRouter, HTTPException
from sqlalchemy import or_
from sqlmodel import select

from ..database import SessionDep
from ..dependencies import CurrentUserDep
from ..models.column_config import (
    ColumnConfig,
    ColumnConfigCreate,
    ColumnConfigPublic,
    ColumnConfigUpdate,
)
from ..models.workspace import WorkspaceMember

router = APIRouter(prefix="/columns", tags=["columns"])

PROTECTED_VISIBILITY = {"task_name", "status", "priority"}
VALID_FIELD_TYPES = {"text", "number", "date", "select"}


def generate_field_key(display_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", display_name.lower()).strip("_")
    return f"cf_{slug}"


def _user_workspace_ids(session, user_id: int) -> list[int]:
    """Get all workspace IDs the user is a member of."""
    members = session.exec(select(WorkspaceMember).where(WorkspaceMember.user_id == user_id)).all()
    return [m.workspace_id for m in members]


def _user_owns_column(col, user_id: int, ws_ids: list[int]) -> bool:
    """Check if a column belongs to the user (via user_id or workspace_id)."""
    if col.user_id == user_id:
        return True
    if col.workspace_id and col.workspace_id in ws_ids:
        return True
    return False


@router.get("", response_model=list[ColumnConfigPublic])
def list_columns(session: SessionDep, current_user: CurrentUserDep, workspace_id: Optional[int] = None):
    if workspace_id:
        statement = select(ColumnConfig).where(ColumnConfig.workspace_id == workspace_id).order_by(ColumnConfig.position)
    else:
        statement = select(ColumnConfig).where(ColumnConfig.user_id == current_user.id).order_by(ColumnConfig.position)
    return session.exec(statement).all()


@router.post("", response_model=ColumnConfigPublic, status_code=201)
def create_column(col_in: ColumnConfigCreate, session: SessionDep, current_user: CurrentUserDep, workspace_id: Optional[int] = None):
    if col_in.field_type not in VALID_FIELD_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid field_type. Must be one of: {', '.join(VALID_FIELD_TYPES)}")

    if col_in.field_type == "select":
        if not col_in.options:
            raise HTTPException(status_code=400, detail="Select type requires options (JSON array)")
        try:
            opts = json.loads(col_in.options)
            if not isinstance(opts, list) or len(opts) == 0:
                raise ValueError()
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(status_code=400, detail="Options must be a non-empty JSON array of strings")

    field_key = generate_field_key(col_in.display_name)

    # Ensure unique key — check by workspace if provided, otherwise by user
    if workspace_id:
        existing = session.exec(select(ColumnConfig).where(ColumnConfig.field_key == field_key, ColumnConfig.workspace_id == workspace_id)).first()
    else:
        existing = session.exec(select(ColumnConfig).where(ColumnConfig.field_key == field_key, ColumnConfig.user_id == current_user.id)).first()
    if existing:
        i = 2
        while True:
            candidate = f"{field_key}_{i}"
            if workspace_id:
                dup = session.exec(select(ColumnConfig).where(ColumnConfig.field_key == candidate, ColumnConfig.workspace_id == workspace_id)).first()
            else:
                dup = session.exec(select(ColumnConfig).where(ColumnConfig.field_key == candidate, ColumnConfig.user_id == current_user.id)).first()
            if not dup:
                field_key = candidate
                break
            i += 1

    # Get max position — by workspace if provided, otherwise by user
    if workspace_id:
        all_cols = session.exec(select(ColumnConfig).where(ColumnConfig.workspace_id == workspace_id)).all()
    else:
        all_cols = session.exec(select(ColumnConfig).where(ColumnConfig.user_id == current_user.id)).all()
    max_pos = max((c.position for c in all_cols), default=-1)

    col = ColumnConfig(
        field_key=field_key,
        display_name=col_in.display_name,
        field_type=col_in.field_type,
        position=max_pos + 1,
        is_visible=True,
        is_core=False,
        is_required=False,
        options=col_in.options if col_in.field_type == "select" else None,
        user_id=current_user.id,
        workspace_id=workspace_id,
    )
    session.add(col)
    session.commit()
    session.refresh(col)
    return col


@router.patch("/reorder", response_model=list[ColumnConfigPublic])
def reorder_columns(items: list[dict], session: SessionDep, current_user: CurrentUserDep, workspace_id: Optional[int] = None):
    ws_ids = _user_workspace_ids(session, current_user.id)
    for item in items:
        col = session.get(ColumnConfig, item["id"])
        if col and _user_owns_column(col, current_user.id, ws_ids):
            col.position = item["position"]
            session.add(col)
    session.commit()

    if workspace_id:
        return session.exec(select(ColumnConfig).where(ColumnConfig.workspace_id == workspace_id).order_by(ColumnConfig.position)).all()
    return session.exec(select(ColumnConfig).where(ColumnConfig.user_id == current_user.id).order_by(ColumnConfig.position)).all()


@router.patch("/{col_id}", response_model=ColumnConfigPublic)
def update_column(col_id: int, col_in: ColumnConfigUpdate, session: SessionDep, current_user: CurrentUserDep):
    ws_ids = _user_workspace_ids(session, current_user.id)
    col = session.get(ColumnConfig, col_id)
    if not col or not _user_owns_column(col, current_user.id, ws_ids):
        raise HTTPException(status_code=404, detail="Column not found")

    # Protected visibility for task_name, status, priority
    if col.field_key in PROTECTED_VISIBILITY and col_in.is_visible is False:
        raise HTTPException(status_code=400, detail=f"Cannot hide '{col.display_name}' column")

    update_data = col_in.model_dump(exclude_unset=True)

    # Validate options if updating a select column
    if "options" in update_data and col.field_type == "select" and update_data["options"]:
        try:
            opts = json.loads(update_data["options"])
            if not isinstance(opts, list):
                raise ValueError()
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(status_code=400, detail="Options must be a JSON array")

    col.sqlmodel_update(update_data)
    session.add(col)
    session.commit()
    session.refresh(col)
    return col


@router.delete("/{col_id}")
def delete_column(col_id: int, session: SessionDep, current_user: CurrentUserDep):
    ws_ids = _user_workspace_ids(session, current_user.id)
    col = session.get(ColumnConfig, col_id)
    if not col or not _user_owns_column(col, current_user.id, ws_ids):
        raise HTTPException(status_code=404, detail="Column not found")
    if col.is_core:
        raise HTTPException(status_code=400, detail="Cannot delete core column")

    session.delete(col)
    session.commit()
    return {"ok": True}
