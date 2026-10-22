"""HTTP poll connect/patch hooks. Webhook ingest is not this spec.

Collector helpers are looked up on ``manager_sources`` at call time so tests can
stub ``server.collector.manager_sources``.
"""

from __future__ import annotations

from typing import Any

from server.collector import manager_sources
from server.collector.http_poll_helpers import normalize_http_credentials
from server.services.sources.credentials import merge_http_credentials
from server.services.sources.presenters import http_source_info
from server.services.sources.registry_types import (
    SourceConnectSpec,
    SourcePatchContext,
    SourceSetupContext,
    _keep_display_name,
    _update_via,
)
from server.services.sources.route_helpers import bind_source_channel, get_source_row


def _http_create_credentials(body: Any) -> dict[str, Any]:
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


def _http_create_name(body: Any, credentials: dict[str, Any]) -> str:
    return str(body.name or credentials["url"])


def _http_merge(existing: dict[str, Any], body: Any) -> dict[str, Any]:
    return merge_http_credentials(
        existing,
        url=body.url,
        method=body.method,
        auth_type=body.authType,
        bearer_token=body.bearerToken,
        basic_username=body.basicUsername,
        basic_password=body.basicPassword,
        headers=body.headers,
        body_type=body.bodyType,
        body=body.body,
        poll_interval_seconds=body.pollIntervalSeconds,
        max_content_chars=body.maxContentChars,
        timeout_seconds=body.timeoutSeconds,
    )


def _http_patch_name(body: Any, row: dict[str, Any], merged: dict[str, Any]) -> str:
    return str(body.name or row.get("name") or merged["url"])


async def _connect_http(
    collector: Any,
    source_id: str,
    credentials: dict[str, Any],
    _body: Any,
) -> dict[str, Any]:
    return await manager_sources.create_http_source(collector, source_id, credentials)


async def _http_response(
    db: Any,
    source_id: str,
    *,
    status: str,
    error_message: str | None,
) -> dict[str, Any]:
    row = await get_source_row(db, source_id)
    info = await http_source_info(db, row)
    return {
        **info,
        "status": status,
        "errorMessage": error_message,
    }


async def _http_connect_error(db: Any, source_id: str, error: str) -> dict[str, Any]:
    return await _http_response(db, source_id, status="error", error_message=error)


async def _http_connect_success(ctx: SourceSetupContext) -> dict[str, Any]:
    return await _http_response(ctx.db, ctx.source_id, status="connected", error_message=None)


async def _http_after_connect(ctx: SourceSetupContext) -> None:
    url = ctx.credentials["url"]
    await bind_source_channel(ctx.db, ctx.source_id, "http", url, url)


async def _http_after_patch(ctx: SourcePatchContext) -> None:
    url = ctx.merged["url"]
    await bind_source_channel(ctx.db, ctx.source_id, "http", url, url)


async def _http_patch_error(db: Any, source_id: str, error_message: str | None) -> dict[str, Any]:
    return await _http_response(db, source_id, status="error", error_message=error_message)


async def _http_patch_success(ctx: SourcePatchContext) -> dict[str, Any]:
    return await _http_response(ctx.db, ctx.source_id, status="connected", error_message=None)


HTTP_SOURCE_SPEC = SourceConnectSpec(
    platform="http",
    platform_label="HTTP",
    wrong_platform_message="Source is not an HTTP source",
    build_credentials=_http_create_credentials,
    create_display_name=_http_create_name,
    connect_collector=_connect_http,
    update_collector=_update_via("update_http_source"),
    merge_credentials=_http_merge,
    patch_display_name=_http_patch_name,
    connect_name=_keep_display_name,
    connect_error=_http_connect_error,
    connect_success=_http_connect_success,
    patch_error=_http_patch_error,
    patch_success=_http_patch_success,
    after_connect=_http_after_connect,
    after_patch=_http_after_patch,
    credential_value_error_is_validation=True,
)
