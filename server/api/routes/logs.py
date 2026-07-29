"""App-log routes: cursor page (``{time, id}`` cursor), append, clear."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from server.api.deps import API_DEPS, get_db
from server.api.schemas.responses import AppLogEntryResponse, AppLogPageResponse
from server.db.schema_ddl import APP_LOG_LEVEL_VALUES
from server.errors import VALIDATION_ERROR, http_error
from server.queries.logs_queries import fetch_app_logs_page
from server.services.log_writes import clear_app_logs, create_app_log
from server.wire.serializers import serialize_app_log

router = APIRouter(prefix="/api/v1/logs", tags=["logs"], dependencies=API_DEPS)


class LogCreate(BaseModel):
    level: str
    category: str
    message: str
    details: Optional[str] = None


@router.get("", response_model=AppLogPageResponse)
async def query_logs_page(
    request: Request,
    cursor_time: Optional[str] = None,
    cursor_id: Optional[str] = None,
    limit: int = 50,
) -> dict:
    db = get_db(request)
    rows, has_more, total_count = await fetch_app_logs_page(
        db,
        cursor_time=cursor_time,
        cursor_id=cursor_id,
        limit=limit,
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
    db = get_db(request)
    row = await create_app_log(
        db,
        level=body.level,
        category=body.category,
        message=body.message,
        details=body.details,
    )
    return serialize_app_log(row)


@router.delete("", status_code=204)
async def clear_logs(request: Request) -> Response:
    await clear_app_logs(get_db(request))
    return Response(status_code=204)
