"""HTTP poll sources: create, update, and list."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request

from server.api.deps import get_db
from server.api.routes.sources.common import router
from server.api.routes.sources.helpers import (
    bind_source_channel,
    connect_source,
    finalize_source_setup,
    get_source_row,
    list_source_channels,
    parse_credentials,
)
from server.api.routes.sources.patch_helpers import PatchSourceFlow, patch_source
from server.api.schemas.requests import HttpSourceBody, HttpSourcePatchBody
from server.api.schemas.responses import AddHttpSourceResponse
from server.collector import manager_sources
from server.collector.http_poll import (
    DEFAULT_MAX_CONTENT_CHARS,
    DEFAULT_TIMEOUT_SECONDS,
    MAX_HEADERS,
    clamp_max_content_chars,
    clamp_timeout_seconds,
    normalize_http_credentials,
)
from server.collector.poll_config import clamp_poll_interval
from server.errors import VALIDATION_ERROR, http_error
from server.secrets import MASKED_SECRET
from server.source_status import mark_source_connected
from server.wire.serializers import serialize_source

logger = logging.getLogger(__name__)


def _body_to_credentials(body: HttpSourceBody) -> dict[str, Any]:
    return normalize_http_credentials(
        {
            "url": body.url,
            "method": body.method,
            "auth_type": body.authType,
            "bearer_token": body.bearerToken,
            "basic_username": body.basicUsername,
            "basic_password": body.basicPassword,
            "headers": body.headers,
            "body_type": body.bodyType,
            "body": body.body,
            "poll_interval_seconds": body.pollIntervalSeconds,
            "max_content_chars": body.maxContentChars,
            "timeout_seconds": body.timeoutSeconds,
        }
    )


def merge_http_credentials(existing: dict[str, Any], body: HttpSourcePatchBody) -> dict[str, Any]:
    merged = dict(existing)
    if body.url is not None:
        merged["url"] = body.url.strip()
    if body.method is not None:
        merged["method"] = body.method
    if body.authType is not None:
        merged["auth_type"] = body.authType
    if body.bearerToken is not None and body.bearerToken != MASKED_SECRET:
        merged["bearer_token"] = body.bearerToken
    if body.basicUsername is not None:
        merged["basic_username"] = body.basicUsername
    if body.basicPassword is not None and body.basicPassword != MASKED_SECRET:
        merged["basic_password"] = body.basicPassword
    if body.headers is not None:
        merged["headers"] = body.headers
    if body.bodyType is not None:
        merged["body_type"] = body.bodyType
    if body.body is not None:
        merged["body"] = body.body
    if body.pollIntervalSeconds is not None:
        merged["poll_interval_seconds"] = clamp_poll_interval(body.pollIntervalSeconds)
    if body.maxContentChars is not None:
        merged["max_content_chars"] = clamp_max_content_chars(body.maxContentChars)
    if body.timeoutSeconds is not None:
        merged["timeout_seconds"] = clamp_timeout_seconds(body.timeoutSeconds)
    return normalize_http_credentials(merged)


async def http_source_info(
    db: Any,
    row: dict[str, Any],
    *,
    channels: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    credentials = parse_credentials(row)
    source_id = str(row["id"])
    if channels is None:
        channels = await list_source_channels(db, source_id, "http")
    headers = credentials.get("headers")
    if not isinstance(headers, dict):
        headers = {}
    auth_type = str(credentials.get("auth_type") or "none")
    return {
        "source": serialize_source(row),
        "url": credentials.get("url") or "",
        "method": str(credentials.get("method") or "GET").upper(),
        "authType": auth_type,
        "bearerToken": MASKED_SECRET if auth_type == "bearer" and credentials.get("bearer_token") else None,
        "basicUsername": credentials.get("basic_username") or None,
        "basicPassword": (
            MASKED_SECRET if auth_type == "basic" and credentials.get("basic_password") is not None else None
        ),
        "headers": {str(k): str(v) for k, v in list(headers.items())[:MAX_HEADERS]},
        "bodyType": str(credentials.get("body_type") or "none"),
        "body": credentials.get("body"),
        "pollIntervalSeconds": clamp_poll_interval(credentials.get("poll_interval_seconds")),
        "maxContentChars": clamp_max_content_chars(credentials.get("max_content_chars", DEFAULT_MAX_CONTENT_CHARS)),
        "timeoutSeconds": clamp_timeout_seconds(credentials.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS)),
        "channel": channels[0] if channels else None,
        "lastError": row.get("last_error"),
        "lastSuccessAt": row.get("last_connected_at"),
    }


async def _http_response(
    db: Any,
    source_id: str,
    *,
    status: str,
    error_message: str | None,
) -> dict:
    row = await get_source_row(db, source_id)
    info = await http_source_info(db, row)
    return {
        **info,
        "status": status,
        "errorMessage": error_message,
    }


@router.post("/http", response_model=AddHttpSourceResponse)
async def create_http_source(request: Request, body: HttpSourceBody) -> dict:
    db = get_db(request)
    try:
        credentials = _body_to_credentials(body)
    except ValueError as exc:
        raise http_error(400, str(exc), error_code=VALIDATION_ERROR) from exc

    source_id, _result, error = await connect_source(
        request,
        platform="http",
        name=body.name or credentials["url"],
        credentials=credentials,
        connect=lambda collector, aid: manager_sources.create_http_source(collector, aid, credentials),
    )
    if error is not None:
        return await _http_response(db, source_id, status="error", error_message=error)

    async def _finalize() -> dict[str, Any]:
        await bind_source_channel(db, source_id, "http", credentials["url"], credentials["url"])
        await mark_source_connected(db, source_id, name=body.name or credentials["url"])
        return await _http_response(db, source_id, status="connected", error_message=None)

    return await finalize_source_setup(request, source_id, _finalize)


@router.patch("/http/{source_id}", response_model=AddHttpSourceResponse)
async def update_http_source(request: Request, source_id: str, body: HttpSourcePatchBody) -> dict:
    db = get_db(request)
    row = await get_source_row(db, source_id)
    if str(row.get("platform")) != "http":
        raise http_error(400, "Source is not an HTTP source", error_code=VALIDATION_ERROR)

    existing = parse_credentials(row)
    try:
        merged = merge_http_credentials(existing, body)
    except ValueError as exc:
        raise http_error(400, str(exc), error_code=VALIDATION_ERROR) from exc

    display_name = body.name or row.get("name") or merged["url"]

    async def _after_success(db: Any, source_id: str, _result: Any) -> None:
        await bind_source_channel(db, source_id, "http", merged["url"], merged["url"])

    return await patch_source(
        request,
        source_id,
        PatchSourceFlow(
            display_name=display_name,
            merged_credentials=merged,
            update_collector=lambda collector, aid, creds: manager_sources.update_http_source(collector, aid, creds),
            after_success=_after_success,
            error_response=lambda db, aid, err: _http_response(db, aid, status="error", error_message=err),
            success_response=lambda db, aid, _result: _http_response(db, aid, status="connected", error_message=None),
            platform_label="HTTP",
        ),
    )
