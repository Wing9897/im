"""App-log routes: cursor page (``{time, id}`` cursor), append, clear."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from server.api.deps import API_DEPS, get_db
from server.api.query_aliases import qalias
from server.api.schemas.requests import LogCreate
from server.api.schemas.responses import AppLogCursorResponse, AppLogEntryResponse, AppLogPageResponse
from server.app_logging import (
    ALLOWED_LOG_CATEGORIES,
    clear_app_logs,
    is_valid_log_kind,
    record_and_fetch,
)
from server.domain.app_log_levels import ALLOWED_APP_LOG_LEVELS
from server.errors import VALIDATION_ERROR, http_error
from server.queries.logs_queries import fetch_app_logs_page
from server.wire.serializers import serialize_app_log

router = APIRouter(prefix="/api/v1/logs", tags=["logs"], dependencies=API_DEPS)


@router.get("", response_model=AppLogPageResponse)
async def query_logs_page(
    request: Request,
    cursor_time: str | None = qalias("cursorTime", default=None),
    cursor_id: str | None = qalias("cursorId", default=None),
    limit: int = 50,
    kind: str | None = None,
    exclude_kind: str | None = qalias("excludeKind", default=None),
) -> AppLogPageResponse:
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
        next_cursor = AppLogCursorResponse(time=str(last["time"]), id=str(last["id"]))
    return AppLogPageResponse(
        logs=[AppLogEntryResponse.model_validate(serialize_app_log(row)) for row in rows],
        nextCursor=next_cursor,
        hasMore=has_more,
        totalCount=total_count,
    )


@router.post("", status_code=201, response_model=AppLogEntryResponse)
async def append_log(request: Request, body: LogCreate) -> AppLogEntryResponse:
    if body.level not in ALLOWED_APP_LOG_LEVELS:
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
    return AppLogEntryResponse.model_validate(serialize_app_log(row))


@router.delete("", status_code=204)
async def clear_logs(request: Request) -> Response:
    await clear_app_logs(get_db(request))
    return Response(status_code=204)
