"""Telegram login flows (phone code / QR / optional 2FA)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request

from server.api.deps import get_collector, get_db
from server.api.routes.sources.common import router
from server.api.routes.sources.helpers import (
    add_source_response,
    add_source_response_from_login,
    create_source_row,
    get_source_row,
)
from server.api.schemas.requests import (
    Telegram2faBody,
    TelegramCodeBody,
    TelegramCredentials,
    TelegramPatchBody,
    TelegramQrCredentials,
    TelegramQrWaitBody,
)
from server.api.schemas.responses import AddSourceResponse, UpdateTelegramSourceResponse
from server.errors import COLLECTOR_UNAVAILABLE, NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries import sources_queries
from server.secrets import MASKED_SECRET
from server.source_credentials import mutate_source_credentials
from server.source_status import set_source_error
from server.util import utc_now_iso
from server.wire.serializers import serialize_source

logger = logging.getLogger(__name__)


def _merge_telegram_credentials(existing: dict[str, Any], body: TelegramPatchBody) -> dict[str, Any]:
    merged = dict(existing)
    if body.apiId is not None:
        merged["api_id"] = int(body.apiId)
    if body.apiHash is not None and body.apiHash not in ("", MASKED_SECRET):
        merged["api_hash"] = body.apiHash.strip()
    if body.phone is not None and body.phone.strip():
        merged["phone"] = body.phone.strip()
    return merged


@router.post(
    "/telegram",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def create_telegram_source(request: Request, body: TelegramCredentials) -> dict:
    db = get_db(request)
    source_row = await create_source_row(
        db,
        platform="telegram",
        name=body.phone,
        credentials={"api_id": body.apiId, "api_hash": body.apiHash, "phone": body.phone},
    )
    source_id = str(source_row["id"])

    collector = get_collector(request)
    if collector is None:
        await set_source_error(db, source_id, "Collector is not running")
        return add_source_response(await get_source_row(db, source_id), "error")

    try:
        result = await collector.start_telegram_login(source_id, body.apiId, body.apiHash, body.phone)
    except Exception as exc:  # noqa: BLE001 — login errors surface as nextStep=error
        logger.warning("Telegram login start failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await get_source_row(db, source_id), "error")

    row = await get_source_row(db, source_id)
    return add_source_response_from_login(row, result)


@router.post(
    "/telegram/qr",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def create_telegram_source_qr(request: Request, body: TelegramQrCredentials) -> dict:
    db = get_db(request)
    source_row = await create_source_row(
        db,
        platform="telegram",
        name="Telegram",
        credentials={"api_id": body.apiId, "api_hash": body.apiHash},
    )
    source_id = str(source_row["id"])

    collector = get_collector(request)
    if collector is None:
        await set_source_error(db, source_id, "Collector is not running")
        return add_source_response(await get_source_row(db, source_id), "error")

    try:
        result = await collector.start_telegram_qr_login(source_id, body.apiId, body.apiHash)
    except Exception as exc:  # noqa: BLE001 — login errors surface as nextStep=error
        logger.warning("Telegram QR login start failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await get_source_row(db, source_id), "error")

    row = await get_source_row(db, source_id)
    return add_source_response_from_login(row, result)


@router.post(
    "/telegram/{source_id}/qr-wait",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def wait_telegram_qr_login(request: Request, source_id: str, body: TelegramQrWaitBody | None = None) -> dict:
    db = get_db(request)
    await get_source_row(db, source_id)
    collector = get_collector(request)
    if collector is None:
        raise http_error(
            503,
            "Collector is not running",
            error_code=COLLECTOR_UNAVAILABLE,
        )
    payload = body or TelegramQrWaitBody()
    try:
        result = await collector.wait_telegram_qr_login(source_id, payload.timeoutSeconds)
    except KeyError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    except Exception as exc:  # noqa: BLE001 — QR wait errors surface as nextStep=error
        logger.warning("Telegram QR wait failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await get_source_row(db, source_id), "error")
    row = await get_source_row(db, source_id)
    return add_source_response_from_login(row, result)


@router.patch("/telegram/{source_id}", response_model=UpdateTelegramSourceResponse)
async def update_telegram_source(request: Request, source_id: str, body: TelegramPatchBody) -> dict:
    db = get_db(request)
    row = await get_source_row(db, source_id)
    if str(row.get("platform")) != "telegram":
        raise http_error(
            400,
            "Source is not a Telegram source",
            error_code=VALIDATION_ERROR,
        )

    if body.name is None and body.apiId is None and body.apiHash is None and body.phone is None:
        raise http_error(400, "No Telegram fields to update", error_code=VALIDATION_ERROR)

    display_name = (body.name.strip() if body.name is not None else None) or row.get("name")
    credentials_touched = body.apiId is not None or body.apiHash is not None or body.phone is not None

    if credentials_touched:
        updated = await mutate_source_credentials(
            db,
            source_id,
            lambda current: _merge_telegram_credentials(current, body),
            name=str(display_name) if display_name else None,
        )
        if updated is None:
            raise http_error(404, f"No source {source_id}", error_code=NOT_FOUND)
    elif body.name is not None:
        await sources_queries.update_source_name(db, source_id, str(display_name), utc_now_iso())

    updated_row = await get_source_row(db, source_id)
    return {
        "source": serialize_source(updated_row),
        "status": updated_row.get("status") or "disconnected",
        "errorMessage": updated_row.get("last_error"),
        "credentialsUpdated": credentials_touched,
    }


@router.post(
    "/telegram/{source_id}/verify-code",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def verify_telegram_code(request: Request, source_id: str, body: TelegramCodeBody) -> dict:
    db = get_db(request)
    await get_source_row(db, source_id)
    collector = get_collector(request)
    if collector is None:
        raise http_error(
            503,
            "Collector is not running",
            error_code=COLLECTOR_UNAVAILABLE,
        )
    try:
        result = await collector.verify_telegram_code(source_id, body.code, body.phoneCodeHash)
    except KeyError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    except Exception as exc:  # noqa: BLE001 — wrong code etc. surface as nextStep=error
        logger.warning("Telegram code verification failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await get_source_row(db, source_id), "error")
    row = await get_source_row(db, source_id)
    return add_source_response_from_login(row, result)


@router.post(
    "/telegram/{source_id}/verify-2fa",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def verify_telegram_2fa(request: Request, source_id: str, body: Telegram2faBody) -> dict:
    db = get_db(request)
    await get_source_row(db, source_id)
    collector = get_collector(request)
    if collector is None:
        raise http_error(
            503,
            "Collector is not running",
            error_code=COLLECTOR_UNAVAILABLE,
        )
    try:
        result = await collector.verify_telegram_2fa(source_id, body.password, body.phoneCodeHash)
    except KeyError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    except Exception as exc:  # noqa: BLE001 — wrong password surfaces as nextStep=error
        logger.warning("Telegram 2FA failed for %s: %s", source_id, exc)
        await set_source_error(db, source_id, str(exc))
        return add_source_response(await get_source_row(db, source_id), "error")
    row = await get_source_row(db, source_id)
    return add_source_response_from_login(row, result)
