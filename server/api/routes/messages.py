"""Messages routes: filtered list, cursor pagination, external ingestion.

The page cursor shape is ``{timestamp, id}`` (web/src MessageCursor) — note
this differs from the logs cursor ``{time, id}``.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Request
from fastapi.responses import Response

from server.api.deps import API_DEPS, get_broadcaster, get_collector, get_db
from server.api.schemas.requests import IngestBatchBody, IngestMessageBody
from server.api.schemas.responses import (
    MessageResponse,
    MessagesIngestBatchResponse,
    MessagesPageResponse,
)
from server.db.database import TransactionDb
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.ingestion import insert_message
from server.message_media import MediaServiceError, MessageMediaService
from server.queries.messages_queries import (
    MessagesQueryError,
    fetch_messages_page,
    message_source_exists,
)
from server.util import new_id, utc_now_iso

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/messages", tags=["messages"], dependencies=API_DEPS)


@router.get("/{message_id}/media")
async def get_message_media(request: Request, message_id: str) -> Response:
    """Stream Telegram message media from memory (no disk cache)."""
    service = MessageMediaService(get_db(request), get_collector(request))
    try:
        body, mime = await service.fetch(message_id)
    except MediaServiceError as exc:
        error_code = NOT_FOUND if exc.status_code == 404 else None
        raise http_error(exc.status_code, exc.detail, error_code=error_code) from exc

    return Response(content=body, media_type=mime)


@router.get("/page", response_model=MessagesPageResponse)
async def get_messages_page(
    request: Request,
    source_ids: Optional[str] = None,
    time_range: Optional[str] = None,
    search: Optional[str] = None,
    platform: Optional[str] = None,
    channel_ids: Optional[str] = None,
    cursor_time: Optional[str] = None,
    cursor_id: Optional[str] = None,
    limit: int = 50,
    include_total: bool = True,
) -> dict:
    db = get_db(request)
    try:
        return await fetch_messages_page(
            db,
            source_ids=source_ids,
            time_range=time_range,
            search=search,
            platform=platform,
            channel_ids=channel_ids,
            cursor_time=cursor_time,
            cursor_id=cursor_id,
            limit=limit,
            include_total=include_total,
        )
    except MessagesQueryError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc


# ── external ingestion (documented under 來源 → HTTP → Webhook /sources?tab=http&mode=webhook) ──


async def _insert_ingested(db: Any, body: IngestMessageBody) -> Optional[dict]:
    platform_id = body.channelId or body.platformId
    if not platform_id:
        raise http_error(
            422,
            "channelId (or platformId) is required",
            error_code=VALIDATION_ERROR,
        )
    timestamp = body.timestamp or body.messageTime or utc_now_iso()

    # An unknown sourceId must not violate the FK.
    source_id = body.sourceId
    if source_id and not await message_source_exists(db, source_id):
        source_id = None

    raw_data = json.dumps({"metadata": body.metadata}, ensure_ascii=False) if body.metadata else None
    return await insert_message(
        db,
        message_id=body.id or new_id(),
        source_id=source_id,
        platform=body.platform,
        platform_id=platform_id,
        content=body.content,
        timestamp=timestamp,
        sender_id=body.senderId,
        sender_name=body.senderName,
        platform_message_id=body.platformMessageId,
        raw_data=raw_data,
    )


@router.post("", status_code=201, response_model=MessageResponse)
async def ingest_message(request: Request, body: IngestMessageBody) -> dict:
    db = get_db(request)
    message = await _insert_ingested(db, body)
    if message is None:
        raise http_error(409, "Duplicate message", error_code=VALIDATION_ERROR)
    get_broadcaster(request).publish("messages_updated", {"messages": [message]})
    return message


@router.post("/batch", response_model=MessagesIngestBatchResponse)
async def ingest_messages_batch(request: Request, body: IngestBatchBody) -> dict:
    db = get_db(request)
    inserted: list[dict] = []
    # All-or-nothing: the whole batch commits in one transaction.
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        for item in body.messages:
            message = await _insert_ingested(tx, item)
            if message is not None:
                inserted.append(message)
    if inserted:
        get_broadcaster(request).publish("messages_updated", {"messages": inserted})
    return {"count": len(inserted)}
