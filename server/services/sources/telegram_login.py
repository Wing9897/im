"""Telegram phone-code, QR, and 2FA login. Not part of ``connect_source``."""

from __future__ import annotations

import logging
from typing import Any

from server.db.database import Database
from server.errors import COLLECTOR_UNAVAILABLE, NOT_FOUND
from server.queries import sources_queries
from server.services.sources.errors import SourceFlowError
from server.services.sources.login_response import add_source_response, add_source_response_from_login
from server.services.sources.records import create_source_row
from server.source_status import set_source_error

logger = logging.getLogger(__name__)


async def _load_source_row(db: Database, source_id: str) -> dict[str, Any]:
    row = await sources_queries.fetch_source_row(db, source_id)
    if row is None:
        raise SourceFlowError(f"Source {source_id} not found", http_status=404, error_code=NOT_FOUND)
    return row


def _collector_unavailable() -> SourceFlowError:
    return SourceFlowError(
        "Collector is not running",
        http_status=503,
        error_code=COLLECTOR_UNAVAILABLE,
    )


async def start_telegram_phone_login(
    db: Database,
    collector: Any | None,
    *,
    api_id: int,
    api_hash: str,
    phone: str,
) -> dict[str, Any]:
    source_row = await create_source_row(
        db,
        platform="telegram",
        name=phone,
        credentials={"api_id": api_id, "api_hash": api_hash, "phone": phone},
    )
    source_id = str(source_row["id"])
    if collector is None:
        await set_source_error(db, source_id, "Collector is not running")
        return add_source_response(await _load_source_row(db, source_id), "error")
    try:
        result = await collector.start_telegram_login(source_id, api_id, api_hash, phone)
    except Exception as exc:  # noqa: BLE001 — login errors surface as nextStep=error
        logger.warning("Telegram login start failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await _load_source_row(db, source_id), "error")
    return add_source_response_from_login(await _load_source_row(db, source_id), result)


async def start_telegram_qr_login(
    db: Database,
    collector: Any | None,
    *,
    api_id: int,
    api_hash: str,
) -> dict[str, Any]:
    source_row = await create_source_row(
        db,
        platform="telegram",
        name="Telegram",
        credentials={"api_id": api_id, "api_hash": api_hash},
    )
    source_id = str(source_row["id"])
    if collector is None:
        await set_source_error(db, source_id, "Collector is not running")
        return add_source_response(await _load_source_row(db, source_id), "error")
    try:
        result = await collector.start_telegram_qr_login(source_id, api_id, api_hash)
    except Exception as exc:  # noqa: BLE001 — login errors surface as nextStep=error
        logger.warning("Telegram QR login start failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await _load_source_row(db, source_id), "error")
    return add_source_response_from_login(await _load_source_row(db, source_id), result)


async def wait_telegram_qr_login(
    db: Database,
    collector: Any | None,
    source_id: str,
    *,
    timeout_seconds: float | None,
) -> dict[str, Any]:
    await _load_source_row(db, source_id)
    if collector is None:
        raise _collector_unavailable()
    try:
        result = await collector.wait_telegram_qr_login(source_id, timeout_seconds)
    except KeyError as exc:
        raise SourceFlowError(str(exc), http_status=404, error_code=NOT_FOUND) from exc
    except Exception as exc:  # noqa: BLE001 — QR wait errors surface as nextStep=error
        logger.warning("Telegram QR wait failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await _load_source_row(db, source_id), "error")
    return add_source_response_from_login(await _load_source_row(db, source_id), result)


async def verify_telegram_code(
    db: Database,
    collector: Any | None,
    source_id: str,
    *,
    code: str,
    phone_code_hash: str | None,
) -> dict[str, Any]:
    await _load_source_row(db, source_id)
    if collector is None:
        raise _collector_unavailable()
    try:
        result = await collector.verify_telegram_code(source_id, code, phone_code_hash)
    except KeyError as exc:
        raise SourceFlowError(str(exc), http_status=404, error_code=NOT_FOUND) from exc
    except Exception as exc:  # noqa: BLE001 — wrong code etc. surface as nextStep=error
        logger.warning("Telegram code verification failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await _load_source_row(db, source_id), "error")
    return add_source_response_from_login(await _load_source_row(db, source_id), result)


async def verify_telegram_2fa(
    db: Database,
    collector: Any | None,
    source_id: str,
    *,
    password: str,
    phone_code_hash: str | None,
) -> dict[str, Any]:
    await _load_source_row(db, source_id)
    if collector is None:
        raise _collector_unavailable()
    try:
        result = await collector.verify_telegram_2fa(source_id, password, phone_code_hash)
    except KeyError as exc:
        raise SourceFlowError(str(exc), http_status=404, error_code=NOT_FOUND) from exc
    except Exception as exc:  # noqa: BLE001 — wrong password surfaces as nextStep=error
        logger.warning("Telegram 2FA failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await _load_source_row(db, source_id), "error")
    return add_source_response_from_login(await _load_source_row(db, source_id), result)
