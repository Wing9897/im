"""Per-channel send handlers for actions.

Config shapes come from web/src/types/actions.ts:
- telegram_bot:   {bot_token, chat_id}
- discord_webhook:{webhook_url}
- http_webhook:   {url, method, headers, include_raw_data}
- mqtt:           {broker_url, topic, username, password, qos}

Every handler returns {"success": bool, "error"?: str} and never raises.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import aiohttp

from server.outbound import OutboundUrlError, validate_outbound_host, validate_outbound_url
from server.util import parse_mqtt_url

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT_SECONDS = 30

_session: aiohttp.ClientSession | None = None


def _get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=_DEFAULT_TIMEOUT_SECONDS))
    return _session


async def close_shared_session() -> None:
    global _session
    if _session is not None and not _session.closed:
        await _session.close()
    _session = None


async def send_telegram_bot(config: dict[str, Any], message: str) -> dict[str, Any]:
    bot_token = config.get("bot_token", "")
    chat_id = config.get("chat_id", "")
    if not bot_token or not chat_id:
        return {"success": False, "error": "Missing required config: bot_token, chat_id"}
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        session = _get_session()
        async with session.post(url, json={"chat_id": chat_id, "text": message}) as resp:
            data = await resp.json()
            if resp.status == 200 and data.get("ok"):
                return {"success": True}
            return {
                "success": False,
                "error": data.get("description", f"HTTP {resp.status}"),
            }
    except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
        return {"success": False, "error": f"Telegram request failed: {exc}"}


async def send_discord_webhook(config: dict[str, Any], message: str) -> dict[str, Any]:
    webhook_url = config.get("webhook_url", "")
    if not webhook_url:
        return {"success": False, "error": "Missing required config: webhook_url"}
    try:
        await validate_outbound_url(webhook_url)
        session = _get_session()
        async with session.post(
            webhook_url,
            json={"content": message},
            allow_redirects=False,
        ) as resp:
            if resp.status in (200, 204):
                return {"success": True}
            try:
                body = await resp.json()
                error_msg = body.get("message", f"HTTP {resp.status}")
            except Exception:  # noqa: BLE001 — best-effort error body parse
                error_msg = f"HTTP {resp.status}"
            return {"success": False, "error": f"Discord webhook error: {error_msg}"}
    except (aiohttp.ClientError, asyncio.TimeoutError, OutboundUrlError) as exc:
        return {"success": False, "error": f"Discord request failed: {exc}"}


async def send_http_webhook(
    config: dict[str, Any], message: str, raw_data: dict[str, Any] | None = None
) -> dict[str, Any]:
    url = config.get("url", "")
    if not url:
        return {"success": False, "error": "Missing required config: url"}
    method = str(config.get("method") or "POST").upper()
    if method not in ("POST", "PUT"):
        method = "POST"
    headers = config.get("headers") or {}
    payload: dict[str, Any] = {"message": message}
    if config.get("include_raw_data") and raw_data is not None:
        payload["rawData"] = raw_data
    try:
        await validate_outbound_url(url)
        session = _get_session()
        async with session.request(
            method,
            url,
            json=payload,
            headers=headers,
            allow_redirects=False,
        ) as resp:
            if resp.status < 400:
                return {"success": True}
            body = await resp.text()
            return {"success": False, "error": f"HTTP {resp.status}: {body[:200]}"}
    except (aiohttp.ClientError, asyncio.TimeoutError, OutboundUrlError) as exc:
        return {"success": False, "error": f"HTTP webhook request failed: {exc}"}


async def send_mqtt(config: dict[str, Any], message: str) -> dict[str, Any]:
    import aiomqtt

    broker_url = config.get("broker_url", "")
    topic = config.get("topic", "")
    if not broker_url or not topic:
        return {"success": False, "error": "Missing required config: broker_url, topic"}
    host, port = parse_mqtt_url(broker_url)
    if not host:
        return {"success": False, "error": f"Invalid broker_url: {broker_url}"}
    try:
        qos = int(config.get("qos") or 0)
    except (TypeError, ValueError):
        qos = 0
    qos = min(max(qos, 0), 2)
    try:
        await validate_outbound_host(host, port)
        async with aiomqtt.Client(
            hostname=host,
            port=port,
            username=config.get("username") or None,
            password=config.get("password") or None,
        ) as client:
            await client.publish(topic, payload=message, qos=qos)
        return {"success": True}
    except (aiomqtt.MqttError, OutboundUrlError) as exc:
        return {"success": False, "error": f"MQTT publish failed: {exc}"}
