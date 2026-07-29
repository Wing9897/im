"""Structural typing for platform-specific adapter capabilities.

Adapters share ``BasePlatformAdapter`` connect/disconnect; optional capabilities
(Discord channel listing, Telegram interactive login, …) are expressed as
Protocols so call sites avoid ``# type: ignore[attr-defined]``.
"""

from __future__ import annotations

from typing import Protocol, cast, runtime_checkable

from server.collector.base import BasePlatformAdapter


@runtime_checkable
class DiscordCapable(Protocol):
    async def list_channels(self) -> list[dict]: ...

    async def set_subscriptions(self, channel_ids: list[str]) -> None: ...


@runtime_checkable
class TelegramLoginCapable(Protocol):
    async def start_login(self, api_id: int, api_hash: str, phone: str) -> dict: ...

    async def start_qr_login(self, api_id: int, api_hash: str) -> dict: ...

    async def wait_qr_login(self, timeout: float | None = None) -> dict: ...

    async def verify_code(self, code: str, phone_code_hash: str | None) -> dict: ...

    async def verify_2fa(self, password: str) -> dict: ...


def as_discord(adapter: BasePlatformAdapter) -> DiscordCapable:
    if not isinstance(adapter, DiscordCapable):
        raise TypeError(f"Account adapter is not Discord-capable (platform={adapter.state.platform})")
    return cast(DiscordCapable, adapter)


def as_telegram_login(adapter: BasePlatformAdapter) -> TelegramLoginCapable:
    if not isinstance(adapter, TelegramLoginCapable):
        raise TypeError(f"Account adapter is not Telegram-login-capable (platform={adapter.state.platform})")
    return cast(TelegramLoginCapable, adapter)
