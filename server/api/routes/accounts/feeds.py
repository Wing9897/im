"""Feed-style sources: RSS feeds and MQTT brokers."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request
from pydantic import BaseModel

from server.account_status import mark_account_connected
from server.api.deps import get_db
from server.api.routes.accounts.common import router
from server.api.routes.accounts.helpers import (
    bind_account_channel,
    connect_source_account,
    finalize_source_account,
    get_account_row,
    list_account_channels,
    parse_credentials,
    source_account_status_response,
    source_connect_error_response,
)
from server.api.routes.accounts.patch_helpers import PatchSourceAccountFlow, patch_source_account
from server.api.schemas.responses import AddMqttBrokerResponse, AddRssFeedResponse
from server.collector import manager_sources
from server.collector.poll_config import DEFAULT_POLL_INTERVAL, clamp_poll_interval
from server.errors import VALIDATION_ERROR, http_error
from server.queries import accounts_queries
from server.secrets import MASKED_SECRET
from server.wire.serializers import serialize_account, serialize_channel

logger = logging.getLogger(__name__)


class MqttBrokerBody(BaseModel):
    brokerUrl: str
    topics: list[str]
    username: Optional[str] = None
    password: Optional[str] = None
    clientId: Optional[str] = None


class MqttBrokerPatchBody(BaseModel):
    brokerUrl: Optional[str] = None
    topics: Optional[list[str]] = None
    username: Optional[str] = None
    password: Optional[str] = None
    clientId: Optional[str] = None
    name: Optional[str] = None


class RssFeedBody(BaseModel):
    feedUrl: str
    name: Optional[str] = None
    pollIntervalSeconds: int = DEFAULT_POLL_INTERVAL


class RssFeedPatchBody(BaseModel):
    feedUrl: Optional[str] = None
    pollIntervalSeconds: Optional[int] = None
    name: Optional[str] = None


async def rss_feed_info(
    db: Any,
    row: dict[str, Any],
    *,
    channels: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    credentials = parse_credentials(row)
    account_id = str(row["id"])
    if channels is None:
        channels = await list_account_channels(db, account_id, "rss")
    return {
        "account": serialize_account(row),
        "feedUrl": credentials.get("feed_url") or "",
        "pollIntervalSeconds": clamp_poll_interval(credentials.get("poll_interval_seconds")),
        "channel": channels[0] if channels else None,
        "lastError": row.get("last_error"),
        "lastSuccessAt": row.get("last_connected_at"),
    }


def mqtt_broker_info(row: dict[str, Any]) -> dict[str, Any]:
    credentials = parse_credentials(row)
    topics = credentials.get("topics")
    return {
        "account": serialize_account(row),
        "brokerUrl": credentials.get("broker_url") or "",
        "topics": topics if isinstance(topics, list) else [],
        "clientId": credentials.get("client_id") or "",
        "lastError": row.get("last_error"),
        "lastSuccessAt": row.get("last_connected_at"),
    }


def merge_mqtt_credentials(existing: dict[str, Any], body: MqttBrokerPatchBody) -> dict[str, Any]:
    merged = dict(existing)
    if body.brokerUrl is not None:
        merged["broker_url"] = body.brokerUrl.strip()
    if body.topics is not None:
        merged["topics"] = body.topics
    if body.username is not None:
        merged["username"] = body.username.strip() or None
    if body.password is not None and body.password != MASKED_SECRET:
        merged["password"] = body.password
    if body.clientId is not None:
        merged["client_id"] = body.clientId.strip() or None
    return merged


async def _mqtt_response(db: Any, account_id: str, *, status: str, error_message: str | None) -> dict:
    return await source_account_status_response(db, account_id, status=status, error_message=error_message)


async def _rss_response(
    db: Any,
    account_id: str,
    *,
    status: str,
    error_message: str | None,
    feed_title: str = "",
    platform: str = "rss",
) -> dict:
    row = await get_account_row(db, account_id)
    channel_row = await accounts_queries.fetch_linked_channel_row(db, account_id, platform)
    return await source_account_status_response(
        db,
        account_id,
        status=status,
        error_message=error_message,
        extra={
            "channel": serialize_channel(channel_row) if channel_row else None,
            "feedTitle": feed_title or row.get("name") or "",
        },
    )


@router.post("/mqtt", response_model=AddMqttBrokerResponse)
async def create_mqtt_broker(request: Request, body: MqttBrokerBody) -> dict:
    db = get_db(request)
    account_id, _, error = await connect_source_account(
        request,
        platform="mqtt",
        name=body.brokerUrl,
        credentials={
            "broker_url": body.brokerUrl,
            "topics": body.topics,
            "username": body.username,
            "password": body.password,
            "client_id": body.clientId,
        },
        connect=lambda collector, account_id: manager_sources.create_mqtt_broker(
            collector,
            account_id,
            body.brokerUrl,
            body.topics,
            username=body.username,
            password=body.password,
            client_id=body.clientId,
        ),
    )
    if error is not None:
        return await source_connect_error_response(db, account_id)

    async def _finalize() -> dict[str, Any]:
        await bind_account_channel(db, account_id, "mqtt", body.brokerUrl, body.brokerUrl)
        await mark_account_connected(db, account_id)
        return {
            "account": serialize_account(await get_account_row(db, account_id)),
            "status": "connected",
            "errorMessage": None,
        }

    return await finalize_source_account(request, account_id, _finalize)


@router.patch("/mqtt/{account_id}", response_model=AddMqttBrokerResponse)
async def update_mqtt_broker(request: Request, account_id: str, body: MqttBrokerPatchBody) -> dict:
    db = get_db(request)
    row = await get_account_row(db, account_id)
    if str(row.get("platform")) != "mqtt":
        raise http_error(400, "Account is not an MQTT broker", error_code=VALIDATION_ERROR)

    existing = parse_credentials(row)
    merged = merge_mqtt_credentials(existing, body)
    broker_url = str(merged.get("broker_url") or "").strip()
    topics = merged.get("topics")
    if not broker_url:
        raise http_error(400, "Broker URL is required", error_code=VALIDATION_ERROR)
    if not isinstance(topics, list) or not topics:
        raise http_error(400, "At least one topic is required", error_code=VALIDATION_ERROR)

    display_name = body.name or row.get("name") or broker_url

    async def _after_success(db: Any, account_id: str, _result: Any) -> None:
        await bind_account_channel(db, account_id, "mqtt", broker_url, broker_url)

    async def _error_response(db: Any, account_id: str, error_message: str | None) -> dict[str, Any]:
        return await _mqtt_response(db, account_id, status="error", error_message=error_message)

    return await patch_source_account(
        request,
        account_id,
        PatchSourceAccountFlow(
            display_name=display_name,
            merged_credentials=merged,
            update_collector=lambda collector, aid, creds: manager_sources.update_mqtt_broker(collector, aid, creds),
            after_success=_after_success,
            error_response=_error_response,
            success_response=lambda db, aid, _result: _mqtt_response(db, aid, status="connected", error_message=None),
            platform_label="MQTT",
        ),
    )


@router.post("/rss", response_model=AddRssFeedResponse)
async def create_rss_feed(request: Request, body: RssFeedBody) -> dict:
    db = get_db(request)
    poll_interval = clamp_poll_interval(body.pollIntervalSeconds)
    account_id, result, error = await connect_source_account(
        request,
        platform="rss",
        name=body.name or body.feedUrl,
        credentials={"feed_url": body.feedUrl, "poll_interval_seconds": poll_interval},
        connect=lambda collector, account_id: manager_sources.create_rss_feed(
            collector,
            account_id,
            body.feedUrl,
            poll_interval_seconds=poll_interval,
        ),
    )
    if error is not None:
        return await source_connect_error_response(
            db,
            account_id,
            extra={"channel": None, "feedTitle": ""},
        )

    feed_title = str((result or {}).get("feed_title") or "") or (body.name or body.feedUrl)

    async def _finalize() -> dict[str, Any]:
        await bind_account_channel(db, account_id, "rss", body.feedUrl, feed_title)
        await mark_account_connected(db, account_id, name=body.name or feed_title)
        channel_row = await accounts_queries.fetch_channel_row(db, "rss", body.feedUrl)
        return {
            "account": serialize_account(await get_account_row(db, account_id)),
            "channel": serialize_channel(channel_row) if channel_row else None,
            "feedTitle": feed_title,
            "status": "connected",
            "errorMessage": None,
        }

    return await finalize_source_account(request, account_id, _finalize)


@router.patch("/rss/{account_id}", response_model=AddRssFeedResponse)
async def update_rss_feed(request: Request, account_id: str, body: RssFeedPatchBody) -> dict:
    db = get_db(request)
    row = await get_account_row(db, account_id)
    if str(row.get("platform")) != "rss":
        raise http_error(400, "Account is not an RSS feed", error_code=VALIDATION_ERROR)

    existing = parse_credentials(row)
    feed_url = (body.feedUrl or existing.get("feed_url") or "").strip()
    if not feed_url:
        raise http_error(400, "Feed URL is required", error_code=VALIDATION_ERROR)

    poll_interval = (
        clamp_poll_interval(body.pollIntervalSeconds)
        if body.pollIntervalSeconds is not None
        else clamp_poll_interval(existing.get("poll_interval_seconds"))
    )
    merged = {
        **existing,
        "feed_url": feed_url,
        "poll_interval_seconds": poll_interval,
    }
    display_name = body.name or row.get("name") or feed_url

    async def _after_success(db: Any, account_id: str, result: Any) -> None:
        feed_title = str((result or {}).get("feed_title") or "") or display_name
        await bind_account_channel(db, account_id, "rss", feed_url, feed_title)

    async def _success_response(db: Any, account_id: str, result: Any) -> dict:
        feed_title = str((result or {}).get("feed_title") or "") or display_name
        return await _rss_response(
            db,
            account_id,
            status="connected",
            error_message=None,
            feed_title=feed_title,
        )

    return await patch_source_account(
        request,
        account_id,
        PatchSourceAccountFlow(
            display_name=display_name,
            merged_credentials=merged,
            update_collector=lambda collector, aid, creds: manager_sources.update_rss_feed(collector, aid, creds),
            after_success=_after_success,
            error_response=lambda db, aid, err: _rss_response(db, aid, status="error", error_message=err),
            success_response=_success_response,
            platform_label="RSS",
        ),
    )
