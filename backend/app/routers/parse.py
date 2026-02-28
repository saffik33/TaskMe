from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import select

from ..database import SessionDep
from ..dependencies import CurrentUserDep
from ..models.column_config import ColumnConfig
from ..services.llm_service import parse_natural_language

router = APIRouter(prefix="/parse", tags=["parse"])


class ParseRequest(BaseModel):
    text: str
    provider: Optional[str] = None
    tone: Optional[str] = None


@router.post("")
def parse_text(body: ParseRequest, session: SessionDep, current_user: CurrentUserDep):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # Fetch custom columns so LLM knows about them (scoped to user)
    custom_cols = session.exec(
        select(ColumnConfig)
        .where(ColumnConfig.user_id == current_user.id, ColumnConfig.is_core == False, ColumnConfig.is_visible == True)
        .order_by(ColumnConfig.position)
    ).all()
    custom_fields_spec = [
        {"field_key": c.field_key, "display_name": c.display_name, "field_type": c.field_type,
         "options": c.options}
        for c in custom_cols
    ]

    try:
        tasks = parse_natural_language(body.text, body.provider, custom_fields_spec, tone=body.tone)
        return {"tasks": tasks}
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("LLM parsing failed")
        raise HTTPException(status_code=500, detail="LLM parsing failed. Please try again later.")
