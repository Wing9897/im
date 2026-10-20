"""Feed-style sources: RSS feeds and MQTT brokers."""

from __future__ import annotations

from fastapi import Request

from server.api.routes.sources.common import router
from server.api.schemas.requests import MqttBrokerBody, MqttBrokerPatchBody, RssFeedBody, RssFeedPatchBody
from server.api.schemas.responses import AddMqttBrokerResponse, AddRssFeedResponse
from server.services.sources.registry import (
    MQTT_SOURCE_SPEC,
    RSS_SOURCE_SPEC,
    connect_registered_source,
    patch_registered_source,
)


@router.post("/mqtt", response_model=AddMqttBrokerResponse)
async def create_mqtt_broker(request: Request, body: MqttBrokerBody) -> dict:
    return await connect_registered_source(request, MQTT_SOURCE_SPEC, body)


@router.patch("/mqtt/{source_id}", response_model=AddMqttBrokerResponse)
async def update_mqtt_broker(request: Request, source_id: str, body: MqttBrokerPatchBody) -> dict:
    return await patch_registered_source(request, MQTT_SOURCE_SPEC, source_id, body)


@router.post("/rss", response_model=AddRssFeedResponse)
async def create_rss_feed(request: Request, body: RssFeedBody) -> dict:
    return await connect_registered_source(request, RSS_SOURCE_SPEC, body)


@router.patch("/rss/{source_id}", response_model=AddRssFeedResponse)
async def update_rss_feed(request: Request, source_id: str, body: RssFeedPatchBody) -> dict:
    return await patch_registered_source(request, RSS_SOURCE_SPEC, source_id, body)
