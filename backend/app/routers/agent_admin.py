"""Admin proxy routes for managing agents, MCP servers, models, and sessions."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import select

from ..database import SessionDep
from ..dependencies import CurrentUserDep
from ..services.agent_bridge import get_agent_bridge

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(session: SessionDep, current_user: CurrentUserDep):
    """Admin = user who owns at least one workspace."""
    from ..models.workspace import WorkspaceMember
    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.role == "owner",
            WorkspaceMember.status == "accepted",
        )
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


AdminDep = Depends(require_admin)


# ── Agents ──

@router.get("/agents", dependencies=[AdminDep])
async def list_agents():
    bridge = get_agent_bridge()
    return await bridge.proxy_get("/api/agents")


@router.get("/agents/{agent_id}", dependencies=[AdminDep])
async def get_agent(agent_id: str):
    bridge = get_agent_bridge()
    return await bridge.proxy_get(f"/api/agents/{agent_id}")


@router.post("/agents", dependencies=[AdminDep], status_code=201)
async def create_agent(body: dict[str, Any]):
    bridge = get_agent_bridge()
    return await bridge.proxy_post("/api/agents", body)


@router.put("/agents/{agent_id}", dependencies=[AdminDep])
async def update_agent(agent_id: str, body: dict[str, Any]):
    bridge = get_agent_bridge()
    return await bridge.proxy_put(f"/api/agents/{agent_id}", body)


@router.delete("/agents/{agent_id}", dependencies=[AdminDep], status_code=204)
async def delete_agent(agent_id: str):
    bridge = get_agent_bridge()
    await bridge.proxy_delete(f"/api/agents/{agent_id}")
    return Response(status_code=204)


@router.get("/agents/{agent_id}/versions", dependencies=[AdminDep])
async def get_agent_versions(agent_id: str):
    bridge = get_agent_bridge()
    return await bridge.proxy_get(f"/api/agents/{agent_id}/versions")


@router.post("/agents/{agent_id}/rollback", dependencies=[AdminDep])
async def rollback_agent(agent_id: str, body: dict[str, Any]):
    bridge = get_agent_bridge()
    return await bridge.proxy_post(f"/api/agents/{agent_id}/rollback", body)


# ── MCP Servers ──

@router.get("/mcp-servers", dependencies=[AdminDep])
async def list_mcp_servers():
    bridge = get_agent_bridge()
    return await bridge.proxy_get("/api/mcp-servers")


@router.get("/mcp-servers/{server_id}", dependencies=[AdminDep])
async def get_mcp_server(server_id: str):
    bridge = get_agent_bridge()
    return await bridge.proxy_get(f"/api/mcp-servers/{server_id}")


@router.post("/mcp-servers", dependencies=[AdminDep], status_code=201)
async def create_mcp_server(body: dict[str, Any]):
    bridge = get_agent_bridge()
    return await bridge.proxy_post("/api/mcp-servers", body)


@router.put("/mcp-servers/{server_id}", dependencies=[AdminDep])
async def update_mcp_server(server_id: str, body: dict[str, Any]):
    bridge = get_agent_bridge()
    return await bridge.proxy_put(f"/api/mcp-servers/{server_id}", body)


@router.delete("/mcp-servers/{server_id}", dependencies=[AdminDep], status_code=204)
async def delete_mcp_server(server_id: str):
    bridge = get_agent_bridge()
    await bridge.proxy_delete(f"/api/mcp-servers/{server_id}")
    return Response(status_code=204)


@router.post("/mcp-servers/{server_id}/test", dependencies=[AdminDep])
async def test_mcp_server(server_id: str):
    bridge = get_agent_bridge()
    return await bridge.proxy_post(f"/api/mcp-servers/{server_id}/test", {})


# ── Models ──

@router.get("/models", dependencies=[AdminDep])
async def list_models():
    bridge = get_agent_bridge()
    return await bridge.proxy_get("/api/models")


# ── Sessions ──
# Note: /search route registered before /{session_id} to avoid path conflict

@router.get("/sessions/search", dependencies=[AdminDep])
async def search_sessions(q: str = Query(""), limit: int = Query(20)):
    bridge = get_agent_bridge()
    return await bridge.proxy_get("/api/sessions/search", params={"q": q, "limit": limit})


@router.get("/sessions", dependencies=[AdminDep])
async def list_sessions(cursor: str = Query(None), limit: int = Query(20)):
    params: dict[str, str | int] = {"limit": limit}
    if cursor:
        params["cursor"] = cursor
    bridge = get_agent_bridge()
    return await bridge.proxy_get("/api/sessions", params=params)


@router.get("/sessions/{session_id}", dependencies=[AdminDep])
async def get_session(session_id: str):
    bridge = get_agent_bridge()
    return await bridge.proxy_get(f"/api/sessions/{session_id}")


@router.get("/sessions/{session_id}/messages", dependencies=[AdminDep])
async def get_session_messages(session_id: str):
    bridge = get_agent_bridge()
    return await bridge.proxy_get(f"/api/sessions/{session_id}/messages")
