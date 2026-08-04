"""App-log routes: cursor page (``{time, id}`` cursor), append, clear."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel

from server.api.deps import API_DEPS, get_db
from server.api.schemas.responses import AppLogEntryResponse, AppLogPageResponse
from server.app_logging import (
    ALLOWED_LOG_CATEGORIES,
    clear_app_logs,
    is_valid_log_kind,
    record_and_fetch,
)
from server.db.schema_ddl import APP_LOG_LEVEL_VALUES
from server.errors import VALIDATION_ERROR, http_error
from server.queries.logs_queries import fetch_app_logs_page
from server.wire.serializers import serialize_app_log

router = APIRouter(prefix="/api/v1/logs", tags=["logs"], dependencies=API_DEPS)


class LogCreate(BaseModel):
    level: str
    category: str
    kind: str
    message: Optional[str] = None
    messageKey: Optional[str] = None
    messageParams: Optional[dict[str, Any]] = None
    source: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


@router.get("", response_model=AppLogPageResponse)
async def query_logs_page(
    request: Request,
    cursor_time: Optional[str] = None,
    cursor_id: Optional[str] = None,
    limit: int = 50,
    kind: Optional[str] = None,
    exclude_kind: Optional[str] = Query(default=None, alias="excludeKind"),
) -> dict:
    db = get_db(request)
    rows, has_more, total_count = await fetch_app_logs_page(
        db,
        cursor_time=cursor_time,
        cursor_id=cursor_id,
        limit=limit,
        kind=kind,
        exclude_kind=exclude_kind,
    )
    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        next_cursor = {"time": last["time"], "id": last["id"]}
    return {
        "logs": [serialize_app_log(row) for row in rows],
        "nextCursor": next_cursor,
        "hasMore": has_more,
        "totalCount": total_count,
    }


@router.post("", status_code=201, response_model=AppLogEntryResponse)
async def append_log(request: Request, body: LogCreate) -> dict:
    if body.level not in APP_LOG_LEVEL_VALUES:
        raise http_error(
            422,
            f"Invalid level: {body.level}",
            error_code=VALIDATION_ERROR,
        )
    if body.category not in ALLOWED_LOG_CATEGORIES:
        raise http_error(
            422,
            f"Invalid category: {body.category}",
            error_code=VALIDATION_ERROR,
        )
    if not is_valid_log_kind(body.kind):
        raise http_error(
            422,
            f"Invalid kind: {body.kind}",
            error_code=VALIDATION_ERROR,
        )
    if not (body.message or body.messageKey):
        raise http_error(
            422,
            "message or messageKey is required",
            error_code=VALIDATION_ERROR,
        )
    db = get_db(request)
    row = await record_and_fetch(
        db,
        level=body.level,
        category=body.category,
        kind=body.kind,
        message=body.message,
        message_key=body.messageKey,
        message_params=body.messageParams,
        source=body.source or "client.http",
        payload=body.payload,
    )
    return serialize_app_log(row)


@router.delete("", status_code=204)
async def clear_logs(request: Request) -> Response:
    await clear_app_logs(get_db(request))
    return Response(status_code=204)
