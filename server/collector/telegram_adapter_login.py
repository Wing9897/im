"""Telethon login mechanics used by the thin ``TelegramAdapter`` façade."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from telethon import errors

from server.collector.telegram_session import persist_string_session_token, string_session_path
from server.time_iso import to_iso_z
from server.util import utc_now_iso

logger = logging.getLogger(__name__)

QR_WAIT_DEFAULT_SECONDS = 25.0
QR_WAIT_MIN_SECONDS = 5.0
QR_WAIT_MAX_SECONDS = 55.0


async def start_login(adapter: Any, api_id: int, api_hash: str, phone: str) -> dict:
    adapter._api_id = api_id
    adapter._api_hash = api_hash
    adapter._phone = phone
    await adapter.disconnect()
    adapter._client = adapter._create_client()
    await adapter._client.connect()
    if await adapter._client.is_user_authorized():
        await adapter._on_login_success()
        return {"next_step": "connected"}
    sent_code = await adapter._client.send_code_request(phone)
    logger.info("Telegram login code sent for source %s", adapter._source_id)
    return {
        "next_step": "code_required",
        "phone_code_hash": sent_code.phone_code_hash,
    }


async def verify_code(adapter: Any, code: str, phone_code_hash: str | None) -> dict:
    if adapter._client is None:
        raise RuntimeError("Client not initialized. Call start_login first.")
    try:
        assert adapter._phone is not None, "Phone not set. Call start_login first."
        await adapter._client.sign_in(
            adapter._phone,
            code,
            phone_code_hash=phone_code_hash,
        )
    except errors.SessionPasswordNeededError:
        logger.info("2FA required for source %s", adapter._source_id)
        return {"next_step": "2fa_required"}
    await adapter._on_login_success()
    return {"next_step": "connected"}


async def verify_2fa(adapter: Any, password: str) -> dict:
    if adapter._client is None:
        raise RuntimeError("Client not initialized. Call start_login first.")
    await adapter._client.sign_in(password=password)
    await adapter._on_login_success()
    return {"next_step": "connected"}


async def start_qr_login(adapter: Any, api_id: int, api_hash: str) -> dict:
    adapter._api_id = api_id
    adapter._api_hash = api_hash
    adapter._phone = None
    await adapter.disconnect()
    adapter._client = adapter._create_client()
    await adapter._client.connect()
    if await adapter._client.is_user_authorized():
        await adapter._on_login_success()
        return {"next_step": "connected"}
    adapter._qr_login = await adapter._client.qr_login()
    logger.info("Telegram QR login started for source %s", adapter._source_id)
    return qr_login_payload(adapter)


async def wait_qr_login(adapter: Any, timeout: float | None = None) -> dict:
    if adapter._qr_login is None or adapter._client is None:
        raise RuntimeError("QR login not started. Call start_qr_login first.")
    wait_seconds = QR_WAIT_DEFAULT_SECONDS if timeout is None else float(timeout)
    wait_seconds = max(QR_WAIT_MIN_SECONDS, min(QR_WAIT_MAX_SECONDS, wait_seconds))
    async with adapter._qr_wait_lock:
        if adapter._qr_login is None or adapter._client is None:
            raise RuntimeError("QR login not started. Call start_qr_login first.")
        try:
            await adapter._qr_login.wait(timeout=wait_seconds)
        except errors.SessionPasswordNeededError:
            logger.info("2FA required after QR login for source %s", adapter._source_id)
            return {"next_step": "2fa_required"}
        except asyncio.TimeoutError:
            if qr_expires_in_seconds(adapter) <= 1.0:
                await adapter._qr_login.recreate()
                logger.info("Telegram QR login token refreshed for source %s", adapter._source_id)
            return qr_login_payload(adapter)
        await adapter._on_login_success()
        return {"next_step": "connected"}


def qr_expires_in_seconds(adapter: Any) -> float:
    if adapter._qr_login is None:
        return 0.0
    expires = adapter._qr_login.expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return (expires - datetime.now(timezone.utc)).total_seconds()


def qr_login_payload(adapter: Any) -> dict[str, Any]:
    if adapter._qr_login is None:
        raise RuntimeError("QR login not started. Call start_qr_login first.")
    expires = adapter._qr_login.expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return {
        "next_step": "qr_required",
        "qr_url": adapter._qr_login.url,
        "qr_expires_at": to_iso_z(expires),
    }


def persist_string_session(adapter: Any) -> None:
    if adapter._client is None:
        raise RuntimeError("Telegram client missing; cannot persist session")
    session = adapter._client.session
    if session is None:
        raise RuntimeError("Telegram session object missing; cannot persist session")
    token = session.save()
    if not isinstance(token, str) or not token.strip():
        raise RuntimeError("Telegram session.save() returned an empty token")
    path = persist_string_session_token(adapter._session_dir, adapter._source_id, token)
    if not path.is_file() or not path.read_text(encoding="utf-8").strip():
        raise RuntimeError(f"Telegram session file missing after write: {path}")


async def on_login_success(adapter: Any) -> None:
    adapter._qr_login = None
    if adapter._client is None:
        raise RuntimeError("Telegram client missing after login")
    await adapter._apply_logged_in_profile()
    adapter._persist_string_session()
    logger.info(
        "Persisted Telegram session for source %s → %s",
        adapter._source_id,
        string_session_path(adapter._session_dir, adapter._source_id),
    )
    adapter._mark_connected()
    await adapter._update_source_status("connected")
    adapter._broadcast_status_change("connected")
    if adapter._startup_task is not None:
        adapter._startup_task.cancel()
        try:
            await adapter._startup_task
        except asyncio.CancelledError:
            pass
        adapter._startup_task = None
    adapter._history_backfill_done = False
    adapter._startup_task = asyncio.create_task(adapter._finish_startup())
    logger.info("Telegram login successful for source %s", adapter._source_id)


async def apply_logged_in_profile(adapter: Any) -> None:
    if adapter._client is None:
        return
    try:
        me = await adapter._client.get_me()
    except Exception:
        logger.exception("Failed to fetch Telegram profile for source %s", adapter._source_id)
        return
    phone = getattr(me, "phone", None)
    username = getattr(me, "username", None)
    first = (getattr(me, "first_name", None) or "").strip()
    if phone:
        label = str(phone) if str(phone).startswith("+") else f"+{phone}"
        adapter._phone = label
    elif username:
        label = f"@{username}"
    elif first:
        label = first
    else:
        return
    try:
        await adapter._db.execute(
            "UPDATE sources SET name = ?, updated_at = ? "
            "WHERE id = ? AND (name IS NULL OR name = '' OR name = 'Telegram')",
            (label, utc_now_iso(), adapter._source_id),
        )
    except Exception:
        logger.exception("Failed to update Telegram display name for source %s", adapter._source_id)
