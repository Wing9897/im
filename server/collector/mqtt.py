"""MQTT platform adapter using aiomqtt for topic-based message reception."""

from __future__ import annotations

import asyncio
import logging

import aiomqtt

from server.collector.base import BasePlatformAdapter
from server.db.database import Database
from server.outbound import validate_outbound_host
from server.sse import SseBroadcaster
from server.util import new_id, parse_mqtt_url, utc_now_iso

logger = logging.getLogger(__name__)


class MqttAdapter(BasePlatformAdapter):
    """Subscribes to MQTT topics and inserts received payloads as messages."""

    def __init__(
        self,
        account_id: str,
        db: Database,
        broadcaster: SseBroadcaster,
        broker_url: str,
        topics: list[str],
        username: str | None = None,
        password: str | None = None,
        client_id: str | None = None,
        platform_id: str | None = None,
    ) -> None:
        super().__init__(account_id, db, broadcaster)
        self._broker_url = broker_url
        self._topics = topics
        self._username = username
        self._password = password
        self._client_id = client_id
        self._client: aiomqtt.Client | None = None
        self._listen_task: asyncio.Task | None = None
        self._platform_id: str = platform_id or broker_url

    def _platform_name(self) -> str:
        return "mqtt"

    async def connect(self) -> None:
        hostname, port = parse_mqtt_url(self._broker_url)
        await validate_outbound_host(hostname, port)

        client_kwargs: dict = {"hostname": hostname, "port": port}
        if self._username is not None:
            client_kwargs["username"] = self._username
        if self._password is not None:
            client_kwargs["password"] = self._password
        if self._client_id is not None:
            client_kwargs["identifier"] = self._client_id

        self._client = aiomqtt.Client(**client_kwargs)
        await self._client.__aenter__()

        for topic in self._topics:
            await self._client.subscribe(topic)

        self._listen_task = asyncio.create_task(self._listen_loop(), name=f"mqtt-listen-{self._account_id}")

        self._mark_connected()
        self._broadcast_status_change("connected")
        logger.info(
            "MQTT adapter connected to %s:%d for account %s (topics: %s)",
            hostname,
            port,
            self._account_id,
            self._topics,
        )

    async def disconnect(self) -> None:
        if self._listen_task is not None and not self._listen_task.done():
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
            self._listen_task = None

        if self._client is not None:
            try:
                await self._client.__aexit__(None, None, None)
            except (aiomqtt.MqttError, OSError) as exc:
                logger.warning(
                    "Error disconnecting MQTT client for account %s: %s",
                    self._account_id,
                    exc,
                )
            self._client = None

        self._state.status = "disconnected"
        self._state.connected_since = None
        logger.info("MQTT adapter disconnected for account %s", self._account_id)

    async def is_connected(self) -> bool:
        return self._client is not None and self._listen_task is not None and not self._listen_task.done()

    async def _listen_loop(self) -> None:
        assert self._client is not None, "MQTT client not connected"
        try:
            async for message in self._client.messages:
                topic = str(message.topic)

                if isinstance(message.payload, bytes):
                    content = message.payload.decode("utf-8", errors="replace")
                elif message.payload is not None:
                    content = str(message.payload)
                else:
                    content = ""

                try:
                    # MQTT has no native message id; a fresh id makes the
                    # "every payload is distinct" semantics explicit instead of
                    # relying on SQLite treating NULLs as distinct in the
                    # (platform, platform_id, platform_message_id) unique index.
                    await self._insert_message(
                        platform="mqtt",
                        platform_id=self._platform_id,
                        platform_message_id=new_id(),
                        content=content,
                        message_time=utc_now_iso(),
                        sender_name=topic,
                        channel_name=self._broker_url,
                    )
                except (OSError, RuntimeError) as exc:
                    logger.error(
                        "Failed to insert MQTT message for account %s, topic %s: %s",
                        self._account_id,
                        topic,
                        exc,
                    )
        except aiomqtt.MqttError as exc:
            logger.warning(
                "MQTT connection lost for account %s: %s. Reconnecting.",
                self._account_id,
                exc,
            )
            self._state.status = "connecting"
            self._state.last_error = str(exc)
            self._client = None
            await self._reconnect_loop()
        except asyncio.CancelledError:
            raise
