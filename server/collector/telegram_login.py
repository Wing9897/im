"""Interactive Telegram login flows (phone code / QR / optional 2FA).

Kept apart from the collector lifecycle management: these helpers operate on
the manager's adapter registry but only serve the sources routes during an
interactive login session.
"""

from __future__ import annotations

from typing import Any, Protocol

from server.collector.adapter_factory import build_adapter
from server.collector.base import BasePlatformAdapter
from server.collector.capabilities import as_telegram_login


class AdapterRegistry(Protocol):
    """What the login flow needs from CollectorManager."""

    @property
    def adapters(self) -> dict[str, BasePlatformAdapter]: ...

    @property
    def db(self) -> Any: ...

    @property
    def broadcaster(self) -> Any: ...

    def session_dir(self) -> str: ...


async def _ensure_telegram_adapter(
    registry: AdapterRegistry,
    source_id: str,
    api_id: int,
    api_hash: str,
) -> tuple[BasePlatformAdapter, bool]:
    adapter = registry.adapters.get(source_id)
    if adapter is not None:
        return adapter, False
    adapter = build_adapter(
        source_id,
        "telegram",
        {"api_id": api_id, "api_hash": api_hash},
        db=registry.db,
        broadcaster=registry.broadcaster,
        session_dir=registry.session_dir(),
    )
    assert adapter is not None  # api_id/api_hash are always provided here
    registry.adapters[source_id] = adapter
    return adapter, True


async def start_telegram_login(
    registry: AdapterRegistry,
    source_id: str,
    api_id: int,
    api_hash: str,
    phone: str,
) -> dict:
    """Create (or reuse) the Telegram adapter and request the login code."""
    adapter, created = await _ensure_telegram_adapter(registry, source_id, api_id, api_hash)
    try:
        return await as_telegram_login(adapter).start_login(api_id, api_hash, phone)
    except BaseException:
        try:
            await adapter.disconnect()
        finally:
            if created and registry.adapters.get(source_id) is adapter:
                del registry.adapters[source_id]
        raise


async def start_telegram_qr_login(
    registry: AdapterRegistry,
    source_id: str,
    api_id: int,
    api_hash: str,
) -> dict:
    """Create (or reuse) the Telegram adapter and start QR login."""
    adapter, created = await _ensure_telegram_adapter(registry, source_id, api_id, api_hash)
    try:
        return await as_telegram_login(adapter).start_qr_login(api_id, api_hash)
    except BaseException:
        try:
            await adapter.disconnect()
        finally:
            if created and registry.adapters.get(source_id) is adapter:
                del registry.adapters[source_id]
        raise


async def wait_telegram_qr_login(
    registry: AdapterRegistry,
    source_id: str,
    timeout: float | None = None,
) -> dict:
    adapter = registry.adapters.get(source_id)
    if adapter is None:
        raise KeyError(f"No active adapter for source {source_id}")
    return await as_telegram_login(adapter).wait_qr_login(timeout)


async def verify_telegram_code(
    registry: AdapterRegistry,
    source_id: str,
    code: str,
    phone_code_hash: str | None,
) -> dict:
    adapter = registry.adapters.get(source_id)
    if adapter is None:
        raise KeyError(f"No active adapter for source {source_id}")
    return await as_telegram_login(adapter).verify_code(code, phone_code_hash)


async def verify_telegram_2fa(
    registry: AdapterRegistry,
    source_id: str,
    password: str,
) -> dict:
    adapter = registry.adapters.get(source_id)
    if adapter is None:
        raise KeyError(f"No active adapter for source {source_id}")
    return await as_telegram_login(adapter).verify_2fa(password)
