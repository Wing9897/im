"""Shared FastAPI dependencies and route helpers for /api/v1 routers."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request

from server.auth import verify_auth, verify_write_access
from server.db.database import Database
from server.sse import publish_resource_modified as sse_publish_resource_modified

#: Standard dependency stack: auth + remote write protection.
#: verify_write_access is method-aware, so applying it to GET routes is a no-op.
API_DEPS = [Depends(verify_auth), Depends(verify_write_access)]


async def require_row(db: Database, table: str, kind: str, row_id: str) -> dict[str, Any]:
    """Fetch a row by primary key or raise 404 with a "<Kind> <id> not found" detail."""
    row = await db.fetch_one(f"SELECT * FROM {table} WHERE id = ?", (row_id,))
    if row is None:
        raise HTTPException(status_code=404, detail=f"{kind} {row_id} not found")
    return row


def publish_resource_modified(request: Request, resource_type: str, resource_id: str, action: str) -> None:
    """Route-side entry point for the ``resource_modified`` SSE notification."""
    sse_publish_resource_modified(
        get_broadcaster(request),
        resource_type=resource_type,
        resource_id=resource_id,
        action=action,
    )


def get_db(request: Request) -> Database:
    return request.app.state.db


def get_broadcaster(request: Request) -> Any:
    return request.app.state.broadcaster


def get_scheduler(request: Request) -> Any:
    return request.app.state.scheduler


def get_collector(request: Request) -> Any:
    return getattr(request.app.state, "collector", None)


def get_analysis_engine(request: Request) -> Any:
    return request.app.state.analysis_engine


def get_action_executor(request: Request) -> Any:
    return request.app.state.action_executor
