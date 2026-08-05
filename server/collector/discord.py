"""Discord platform adapter using the Gateway WebSocket (aiohttp).

Receives real-time MESSAGE_CREATE events from subscribed text channels and
inserts them under the ``(platform, platform_id)`` composite channel key.
"""

from __future__ import annotations

import asyncio
import json
import logging

import aiohttp

from server.collector.base import BasePlatformAdapter
from server.db.database import Database
from server.sse import SseBroadcaster

logger = logging.getLogger(__name__)

INTENT_GUILDS = 1 << 0
INTENT_GUILD_MESSAGES = 1 << 9
INTENT_MESSAGE_CONTENT = 1 << 15

OP_DISPATCH = 0
OP_HEARTBEAT = 1
OP_IDENTIFY = 2
OP_HELLO = 10

DISCORD_API_BASE = "https://discord.com/api/v10"
DISCORD_GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json"


class DiscordAdapter(BasePlatformAdapter):
    """Connects a Discord bot to the Gateway and receives channel messages."""

    def __init__(
        self,
        source_id: str,
        db: Database,
        broadcaster: SseBroadcaster,
        bot_token: str,
    ) -> None:
        super().__init__(source_id, db, broadcaster)
        self._bot_token = bot_token
        self._subscribed_channel_ids: set[str] = set()
        self._session: aiohttp.ClientSession | None = None
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._gateway_task: asyncio.Task | None = None
        self._heartbeat_task: asyncio.Task | None = None
        self._reconnect_task: asyncio.Task | None = None
        self._last_sequence: int | None = None

    def _platform_name(self) -> str:
        return "discord"

    async def connect(self) -> None:
        """Connect to the Gateway, identify, and start listening."""
        self._state.status = "connecting"
        self._session = aiohttp.ClientSession()

        try:
            self._ws = await self._session.ws_connect(DISCORD_GATEWAY_URL)
        except (aiohttp.ClientError, OSError) as exc:
            await self._session.close()
            self._session = None
            self._state.status = "error"
            self._state.last_error = str(exc)
            raise

        hello_msg = await self._ws.receive_json()
        if hello_msg.get("op") != OP_HELLO:
            await self._cleanup()
            raise ConnectionError("Expected HELLO from Discord Gateway")

        heartbeat_interval_ms = hello_msg["d"]["heartbeat_interval"]

        await self._ws.send_json(
            {
                "op": OP_IDENTIFY,
                "d": {
                    "token": self._bot_token,
                    "intents": INTENT_GUILDS | INTENT_GUILD_MESSAGES | INTENT_MESSAGE_CONTENT,
                    "properties": {
                        "os": "windows",
                        "browser": "intelligence-monitor",
                        "device": "intelligence-monitor",
                    },
                },
            }
        )

        await self._load_subscriptions()

        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop(heartbeat_interval_ms / 1000.0))
        self._gateway_task = asyncio.create_task(self._gateway_listener())

        self._mark_connected()
        self._broadcast_status_change("connected")
        logger.info("Discord adapter connected for source %s", self._source_id)

    async def disconnect(self) -> None:
        await self._cleanup()
        self._state.status = "disconnected"
        self._state.connected_since = None
        logger.info("Discord adapter disconnected for source %s", self._source_id)

    async def is_connected(self) -> bool:
        return self._ws is not None and not self._ws.closed

    async def list_channels(self) -> list[dict]:
        """List text channels across every guild the bot can access."""
        if self._session is None or self._session.closed:
            raise RuntimeError("Discord adapter is not connected")

        headers = {"Authorization": f"Bot {self._bot_token}"}

        async with self._session.get(f"{DISCORD_API_BASE}/users/@me/guilds", headers=headers) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise RuntimeError(f"Failed to fetch guilds: HTTP {resp.status} - {error_text}")
            guilds = await resp.json()

        channels: list[dict] = []
        for guild in guilds:
            guild_id = guild["id"]
            guild_name = guild["name"]
            async with self._session.get(f"{DISCORD_API_BASE}/guilds/{guild_id}/channels", headers=headers) as resp:
                if resp.status != 200:
                    logger.warning(
                        "Failed to fetch channels for guild %s: HTTP %d",
                        guild_id,
                        resp.status,
                    )
                    continue
                guild_channels = await resp.json()

            for ch in guild_channels:
                if ch.get("type") == 0:  # text channel
                    channels.append(
                        {
                            "id": ch["id"],
                            "name": ch["name"],
                            "guild_id": guild_id,
                            "guild_name": guild_name,
                        }
                    )
        return channels

    async def set_subscriptions(self, channel_ids: list[str]) -> None:
        self._subscribed_channel_ids = set(channel_ids)
        logger.info(
            "Discord subscriptions updated for source %s: %d channels",
            self._source_id,
            len(self._subscribed_channel_ids),
        )

    async def _load_subscriptions(self) -> None:
        """Restore subscribed channel ids from ``source_channels``."""
        rows = await self._db.fetch_all(
            "SELECT platform_id FROM source_channels WHERE source_id = ? AND platform = 'discord'",
            (self._source_id,),
        )
        self._subscribed_channel_ids = {str(row["platform_id"]) for row in rows}

    # ── gateway internals ───────────────────────────────────────────────

    async def _gateway_listener(self) -> None:
        if self._ws is None:
            return
        try:
            async for msg in self._ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    await self._handle_gateway_event(data)
                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    logger.warning(
                        "Discord WebSocket closed/errored for source %s",
                        self._source_id,
                    )
                    break
        except asyncio.CancelledError:
            return
        except (aiohttp.ClientError, OSError) as exc:
            logger.error(
                "Discord gateway listener error for source %s: %s",
                self._source_id,
                exc,
            )

        if self._state.status == "connected":
            self._state.status = "disconnected"
            self._reconnect_task = asyncio.create_task(self._reconnect_loop())
            self._reconnect_task.add_done_callback(self._on_reconnect_done)

    def _on_reconnect_done(self, task: asyncio.Task) -> None:
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            logger.error(
                "Discord reconnect task failed for source %s: %s",
                self._source_id,
                exc,
                exc_info=exc,
            )

    async def _handle_gateway_event(self, data: dict) -> None:
        op = data.get("op")
        seq = data.get("s")
        if seq is not None:
            self._last_sequence = seq
        if op == OP_DISPATCH and data.get("t") == "MESSAGE_CREATE":
            await self._handle_message_create(data["d"])

    async def _handle_message_create(self, message_data: dict) -> None:
        channel_id = message_data.get("channel_id", "")
        if channel_id not in self._subscribed_channel_ids:
            return

        author = message_data.get("author", {})
        if author.get("bot", False):
            return

        guild_id = message_data.get("guild_id", "")
        raw_data = json.dumps({"guild_id": guild_id}) if guild_id else None

        await self._insert_message(
            platform="discord",
            platform_id=channel_id,
            content=message_data.get("content", ""),
            message_time=message_data.get("timestamp", ""),
            sender_name=author.get("username", "unknown"),
            sender_id=str(author.get("id")) if author.get("id") else None,
            platform_message_id=str(message_data.get("id")) if message_data.get("id") else None,
            raw_data=raw_data,
        )

    async def _heartbeat_loop(self, interval: float) -> None:
        try:
            while True:
                await asyncio.sleep(interval)
                if self._ws is None or self._ws.closed:
                    break
                await self._ws.send_json({"op": OP_HEARTBEAT, "d": self._last_sequence})
        except asyncio.CancelledError:
            return
        except (aiohttp.ClientError, OSError) as exc:
            logger.error("Discord heartbeat error for source %s: %s", self._source_id, exc)

    async def _cleanup(self) -> None:
        for attr in ("_heartbeat_task", "_gateway_task"):
            task = getattr(self, attr)
            if task is not None:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
                setattr(self, attr, None)

        if self._reconnect_task is not None and self._reconnect_task is not asyncio.current_task():
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass
            self._reconnect_task = None

        if self._ws is not None and not self._ws.closed:
            await self._ws.close()
        self._ws = None

        if self._session is not None and not self._session.closed:
            await self._session.close()
        self._session = None
