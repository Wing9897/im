"""Streamable HTTP MCP control plane at ``/api/v1/mcp``.

Auth mirrors A2A: household access key with full scope ``*``
(``require_full_access_key``). Tools are the base-19 allowlist in
:mod:`server.agent.mcp_tools`, filtered by ``mcp_cap_*`` capability groups.
Master switch ``mcp_enabled`` (default on) rejects protocol traffic with 403.
Session-auth ``GET /api/v1/mcp/status`` probes enabled + exposed tools for the UI.

Protocol Streamable HTTP is an ASGI mount (not enumerated in OpenAPI); only
``GET /status`` is a FastAPI route and appears in OpenAPI.
"""

from __future__ import annotations

from contextvars import ContextVar
from typing import Any

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from mcp.server.lowlevel.server import Server as McpServer
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import TextContent, Tool
from pydantic import BaseModel, ConfigDict
from starlette.routing import Route
from starlette.types import Receive, Scope, Send

from server.agent.mcp_tools import (
    MCP_CAPABILITIES_DEFAULT,
    McpCapabilities,
    execute_mcp_tool,
    is_mcp_enabled,
    load_mcp_capabilities,
    mcp_status_tools,
    mcp_tool_schemas,
    openai_schema_to_mcp_input_schema,
)
from server.api.a2a_auth import require_full_access_key
from server.api.deps import API_DEPS, get_db
from server.errors import FORBIDDEN, error_body

#: FastAPI app for the in-flight MCP HTTP request (db / broadcaster).
_mcp_fastapi_app: ContextVar[FastAPI | None] = ContextVar("mcp_fastapi_app", default=None)

#: Session-auth status probe + registry membership; protocol traffic uses ASGI routes.
router = APIRouter(prefix="/api/v1/mcp", tags=["mcp"], dependencies=API_DEPS)

MCP_DISABLED_MESSAGE = "MCP is disabled (mcp_enabled=false)"


class McpStatusTool(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str = ""


class McpStatusResponse(BaseModel):
    """GET ``/api/v1/mcp/status`` — session-auth probe for Settings UI."""

    model_config = ConfigDict(extra="forbid")

    enabled: bool
    toolCount: int
    tools: list[McpStatusTool]


async def _caps_from_bound_app() -> McpCapabilities:
    app = _mcp_fastapi_app.get()
    if app is None:
        return MCP_CAPABILITIES_DEFAULT
    return await load_mcp_capabilities(app.state.db)


async def _send_json(scope: Scope, receive: Receive, send: Send, *, status_code: int, content: Any) -> None:
    response = JSONResponse(status_code=status_code, content=content)
    await response(scope, receive, send)


@router.get("/status", response_model=McpStatusResponse)
async def mcp_status(request: Request) -> dict[str, Any]:
    """Return master-switch state and currently exposed tools (capability-filtered)."""
    db = get_db(request)
    enabled = await is_mcp_enabled(db)
    if not enabled:
        return {"enabled": False, "toolCount": 0, "tools": []}
    caps = await load_mcp_capabilities(db)
    tools = mcp_status_tools(caps)
    return {"enabled": True, "toolCount": len(tools), "tools": tools}


def _build_mcp_server() -> McpServer[Any, Any]:
    server: McpServer[Any, Any] = McpServer("intelligence-monitor")

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        caps = await _caps_from_bound_app()
        return [
            Tool(
                name=str(schema["name"]),
                description=str(schema.get("description") or ""),
                inputSchema=openai_schema_to_mcp_input_schema(schema),
            )
            for schema in mcp_tool_schemas(caps)
        ]

    @server.call_tool(validate_input=False)
    async def call_tool(name: str, arguments: dict[str, Any] | None) -> dict[str, Any] | list[TextContent]:
        app = _mcp_fastapi_app.get()
        if app is None:
            return {"error": "mcp_runtime_unavailable"}
        caps = await load_mcp_capabilities(app.state.db)
        return await execute_mcp_tool(
            app.state.db,
            name,
            arguments,
            broadcaster=getattr(app.state, "broadcaster", None),
            caps=caps,
        )

    return server


class _McpControlPlaneASGI:
    """Auth gate + Streamable HTTP session manager for one FastAPI app.

    Protocol traffic: ``require_full_access_key`` (full access key). Status probe
    stays on the FastAPI router with normal session auth — intentional split.
    """

    def __init__(self, app: FastAPI, session_manager: StreamableHTTPSessionManager) -> None:
        self._app = app
        self._session_manager = session_manager

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in {"http", "https"}:
            return
        # Bind parent FastAPI so ``require_full_access_key`` / ``get_db`` see app.state.
        auth_scope = dict(scope)
        auth_scope["app"] = self._app
        request = Request(auth_scope, receive)
        db = self._app.state.db
        if not await is_mcp_enabled(db):
            await _send_json(
                scope,
                receive,
                send,
                status_code=403,
                content=error_body(403, MCP_DISABLED_MESSAGE, error_code=FORBIDDEN),
            )
            return
        try:
            await require_full_access_key(request)
        except HTTPException as exc:
            payload = exc.detail
            if not isinstance(payload, dict):
                payload = {
                    "error_code": FORBIDDEN,
                    "message": str(payload),
                    "details": None,
                    "correlation_id": None,
                }
            await _send_json(scope, receive, send, status_code=exc.status_code, content=payload)
            return

        token = _mcp_fastapi_app.set(self._app)
        try:
            await self._session_manager.handle_request(scope, receive, send)
        finally:
            _mcp_fastapi_app.reset(token)


def attach_mcp(app: FastAPI) -> StreamableHTTPSessionManager:
    """Register Streamable HTTP at ``/api/v1/mcp`` (+ trailing slash); return the manager.

    Call once per app from :func:`server.main.create_app`. The host lifespan must
    enter ``session_manager.run()`` (mounted sub-app lifespans do not run).
    """
    mcp_server = _build_mcp_server()
    session_manager = StreamableHTTPSessionManager(
        app=mcp_server,
        json_response=True,
        stateless=True,
        # Bearer auth is the real gate; Host allowlists break ASGI test clients
        # (``testserver``) and LAN OpenClaw URLs without extra config.
        security_settings=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    endpoint = _McpControlPlaneASGI(app, session_manager)
    # Dual routes avoid Starlette Mount's 307 redirect on the no-slash URL.
    app.router.routes.append(Route("/api/v1/mcp", endpoint=endpoint, methods=["GET", "POST", "DELETE"]))
    app.router.routes.append(Route("/api/v1/mcp/", endpoint=endpoint, methods=["GET", "POST", "DELETE"]))
    app.state.mcp_session_manager = session_manager
    return session_manager
