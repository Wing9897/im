"""MQTT connect/patch hooks.

Collector helpers are looked up on ``manager_sources`` at call time so tests can
stub ``server.collector.manager_sources``.
"""

from __future__ import annotations

from typing import Any

from server.collector import manager_sources
from server.errors import VALIDATION_ERROR, http_error
from server.services.sources.credentials import merge_mqtt_credentials
from server.services.sources.registry_types import (
    SourceConnectSpec,
    SourcePatchContext,
    SourceSetupContext,
    _update_via,
)
from server.services.sources.route_helpers import (
    bind_source_channel,
    get_source_row,
    source_connect_error_response,
    source_status_response,
)
from server.wire.serializer_domains.sources import serialize_source


def _mqtt_create_credentials(body: Any) -> dict[str, Any]:
    return {
        "broker_url": body.brokerUrl,
        "topics": body.topics,
        "username": body.username,
        "password": body.password,
        "client_id": body.clientId,
    }


def _mqtt_create_name(body: Any, _credentials: dict[str, Any]) -> str:
    return str(body.brokerUrl)


def _mqtt_merge(existing: dict[str, Any], body: Any) -> dict[str, Any]:
    return merge_mqtt_credentials(
        existing,
        broker_url=body.brokerUrl,
        topics=body.topics,
        username=body.username,
        password=body.password,
        client_id=body.clientId,
    )


def _mqtt_patch_name(body: Any, row: dict[str, Any], merged: dict[str, Any]) -> str:
    broker_url = str(merged.get("broker_url") or "").strip()
    return str(body.name or row.get("name") or broker_url)


def _mqtt_validate(merged: dict[str, Any], _body: Any, _row: dict[str, Any]) -> None:
    broker_url = str(merged.get("broker_url") or "").strip()
    topics = merged.get("topics")
    if not broker_url:
        raise http_error(400, "Broker URL is required", error_code=VALIDATION_ERROR)
    if not isinstance(topics, list) or not topics:
        raise http_error(400, "At least one topic is required", error_code=VALIDATION_ERROR)


def _mqtt_connect_name(_ctx: SourceSetupContext) -> str | None:
    return None


async def _connect_mqtt(
    collector: Any,
    source_id: str,
    _credentials: dict[str, Any],
    body: Any,
) -> dict[str, Any]:
    return await manager_sources.create_mqtt_broker(
        collector,
        source_id,
        body.brokerUrl,
        body.topics,
        username=body.username,
        password=body.password,
        client_id=body.clientId,
    )


async def _mqtt_response(db: Any, source_id: str, *, status: str, error_message: str | None) -> dict[str, Any]:
    return await source_status_response(db, source_id, status=status, error_message=error_message)


async def _mqtt_connect_error(db: Any, source_id: str, _error: str) -> dict[str, Any]:
    return await source_connect_error_response(db, source_id)


async def _mqtt_connect_success(ctx: SourceSetupContext) -> dict[str, Any]:
    return {
        "source": serialize_source(await get_source_row(ctx.db, ctx.source_id)),
        "status": "connected",
        "errorMessage": None,
    }


async def _mqtt_after_connect(ctx: SourceSetupContext) -> None:
    await bind_source_channel(ctx.db, ctx.source_id, "mqtt", ctx.body.brokerUrl, ctx.body.brokerUrl)


async def _mqtt_after_patch(ctx: SourcePatchContext) -> None:
    broker_url = str(ctx.merged.get("broker_url") or "").strip()
    await bind_source_channel(ctx.db, ctx.source_id, "mqtt", broker_url, broker_url)


async def _mqtt_patch_error(db: Any, source_id: str, error_message: str | None) -> dict[str, Any]:
    return await _mqtt_response(db, source_id, status="error", error_message=error_message)


async def _mqtt_patch_success(ctx: SourcePatchContext) -> dict[str, Any]:
    return await _mqtt_response(ctx.db, ctx.source_id, status="connected", error_message=None)


MQTT_SOURCE_SPEC = SourceConnectSpec(
    platform="mqtt",
    platform_label="MQTT",
    wrong_platform_message="Source is not an MQTT broker",
    build_credentials=_mqtt_create_credentials,
    create_display_name=_mqtt_create_name,
    connect_collector=_connect_mqtt,
    update_collector=_update_via("update_mqtt_broker"),
    merge_credentials=_mqtt_merge,
    patch_display_name=_mqtt_patch_name,
    connect_name=_mqtt_connect_name,
    connect_error=_mqtt_connect_error,
    connect_success=_mqtt_connect_success,
    patch_error=_mqtt_patch_error,
    patch_success=_mqtt_patch_success,
    after_connect=_mqtt_after_connect,
    after_patch=_mqtt_after_patch,
    validate_merged=_mqtt_validate,
)
