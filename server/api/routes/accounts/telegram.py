"""Telegram login flows (phone code / QR / optional 2FA)."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request
from pydantic import BaseModel, Field

from server.account_credentials import mutate_account_credentials
from server.account_status import set_account_error
from server.api.deps import get_collector, get_db
from server.api.routes.accounts.common import router
from server.api.routes.accounts.helpers import (
    add_account_response,
    add_account_response_from_login,
    create_account_row,
    get_account_row,
)
from server.api.schemas.responses import AddAccountResponse, UpdateTelegramAccountResponse
from server.errors import COLLECTOR_UNAVAILABLE, NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries import accounts_queries
from server.secrets import MASKED_SECRET
from server.util import utc_now_iso
from server.wire.serializers import serialize_account

logger = logging.getLogger(__name__)


class TelegramCredentials(BaseModel):
    apiId: int
    apiHash: str
    phone: str


class TelegramQrCredentials(BaseModel):
    apiId: int
    apiHash: str


class TelegramQrWaitBody(BaseModel):
    timeoutSeconds: Optional[float] = Field(default=None, ge=5, le=55)


class TelegramCodeBody(BaseModel):
    code: str
    pendingLoginStage: Optional[str] = None
    phoneCodeHash: Optional[str] = None


class Telegram2faBody(BaseModel):
    password: str
    pendingLoginStage: Optional[str] = None
    phoneCodeHash: Optional[str] = None


class TelegramPatchBody(BaseModel):
    """Safe in-place edits: display name and optional stored credential fields.

    Changing apiId / apiHash / phone updates encrypted credentials only — the
    live StringSession is not rewritten here; reconnect / re-login may be required.
    """

    name: Optional[str] = None
    apiId: Optional[int] = None
    apiHash: Optional[str] = None
    phone: Optional[str] = None


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
    response_model=AddAccountResponse,
    response_model_exclude_unset=True,
)
async def create_telegram_account(request: Request, body: TelegramCredentials) -> dict:
    db = get_db(request)
    account_row = await create_account_row(
        db,
        platform="telegram",
        name=body.phone,
        credentials={"api_id": body.apiId, "api_hash": body.apiHash, "phone": body.phone},
    )
    account_id = str(account_row["id"])

    collector = get_collector(request)
    if collector is None:
        await set_account_error(db, account_id, "Collector is not running")
        return add_account_response(await get_account_row(db, account_id), "error")

    try:
        result = await collector.start_telegram_login(account_id, body.apiId, body.apiHash, body.phone)
    except Exception as exc:  # noqa: BLE001 — login errors surface as nextStep=error
        logger.warning("Telegram login start failed for %s: %s", account_id, exc)
        await set_account_error(db, account_id, str(exc))
        return add_account_response(await get_account_row(db, account_id), "error")

    row = await get_account_row(db, account_id)
    return add_account_response_from_login(row, result)


@router.post(
    "/telegram/qr",
    response_model=AddAccountResponse,
    response_model_exclude_unset=True,
)
async def create_telegram_account_qr(request: Request, body: TelegramQrCredentials) -> dict:
    db = get_db(request)
    account_row = await create_account_row(
        db,
        platform="telegram",
        name="Telegram",
        credentials={"api_id": body.apiId, "api_hash": body.apiHash},
    )
    account_id = str(account_row["id"])

    collector = get_collector(request)
    if collector is None:
        await set_account_error(db, account_id, "Collector is not running")
        return add_account_response(await get_account_row(db, account_id), "error")

    try:
        result = await collector.start_telegram_qr_login(account_id, body.apiId, body.apiHash)
    except Exception as exc:  # noqa: BLE001 — login errors surface as nextStep=error
        logger.warning("Telegram QR login start failed for %s: %s", account_id, exc)
        await set_account_error(db, account_id, str(exc))
        return add_account_response(await get_account_row(db, account_id), "error")

    row = await get_account_row(db, account_id)
    return add_account_response_from_login(row, result)


@router.post(
    "/telegram/{account_id}/qr-wait",
    response_model=AddAccountResponse,
    response_model_exclude_unset=True,
)
async def wait_telegram_qr_login(request: Request, account_id: str, body: TelegramQrWaitBody | None = None) -> dict:
    db = get_db(request)
    await get_account_row(db, account_id)
    collector = get_collector(request)
    if collector is None:
        raise http_error(
            503,
            "Collector is not running",
            error_code=COLLECTOR_UNAVAILABLE,
        )
    payload = body or TelegramQrWaitBody()
    try:
        result = await collector.wait_telegram_qr_login(account_id, payload.timeoutSeconds)
    except KeyError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    except Exception as exc:  # noqa: BLE001 — QR wait errors surface as nextStep=error
        logger.warning("Telegram QR wait failed for %s: %s", account_id, exc)
        await set_account_error(db, account_id, str(exc))
        return add_account_response(await get_account_row(db, account_id), "error")
    row = await get_account_row(db, account_id)
    return add_account_response_from_login(row, result)


@router.patch("/telegram/{account_id}", response_model=UpdateTelegramAccountResponse)
async def update_telegram_account(request: Request, account_id: str, body: TelegramPatchBody) -> dict:
    db = get_db(request)
    row = await get_account_row(db, account_id)
    if str(row.get("platform")) != "telegram":
        raise http_error(
            400,
            "Account is not a Telegram account",
            error_code=VALIDATION_ERROR,
        )

    if body.name is None and body.apiId is None and body.apiHash is None and body.phone is None:
        raise http_error(400, "No Telegram fields to update", error_code=VALIDATION_ERROR)

    display_name = (body.name.strip() if body.name is not None else None) or row.get("name")
    credentials_touched = body.apiId is not None or body.apiHash is not None or body.phone is not None

    if credentials_touched:
        updated = await mutate_account_credentials(
            db,
            account_id,
            lambda current: _merge_telegram_credentials(current, body),
            name=str(display_name) if display_name else None,
        )
        if updated is None:
            raise http_error(404, f"No account {account_id}", error_code=NOT_FOUND)
    elif body.name is not None:
        await accounts_queries.update_account_name(db, account_id, str(display_name), utc_now_iso())

    updated_row = await get_account_row(db, account_id)
    return {
        "account": serialize_account(updated_row),
        "status": updated_row.get("status") or "disconnected",
        "errorMessage": updated_row.get("last_error"),
        "credentialsUpdated": credentials_touched,
    }


@router.post(
    "/telegram/{account_id}/verify-code",
    response_model=AddAccountResponse,
    response_model_exclude_unset=True,
)
async def verify_telegram_code(request: Request, account_id: str, body: TelegramCodeBody) -> dict:
    db = get_db(request)
    await get_account_row(db, account_id)
    collector = get_collector(request)
    if collector is None:
        raise http_error(
            503,
            "Collector is not running",
            error_code=COLLECTOR_UNAVAILABLE,
        )
    try:
        result = await collector.verify_telegram_code(account_id, body.code, body.phoneCodeHash)
    except KeyError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    except Exception as exc:  # noqa: BLE001 — wrong code etc. surface as nextStep=error
        logger.warning("Telegram code verification failed for %s: %s", account_id, exc)
        await set_account_error(db, account_id, str(exc))
        return add_account_response(await get_account_row(db, account_id), "error")
    row = await get_account_row(db, account_id)
    return add_account_response_from_login(row, result)


@router.post(
    "/telegram/{account_id}/verify-2fa",
    response_model=AddAccountResponse,
    response_model_exclude_unset=True,
)
async def verify_telegram_2fa(request: Request, account_id: str, body: Telegram2faBody) -> dict:
    db = get_db(request)
    await get_account_row(db, account_id)
    collector = get_collector(request)
    if collector is None:
        raise http_error(
            503,
            "Collector is not running",
            error_code=COLLECTOR_UNAVAILABLE,
        )
    try:
        result = await collector.verify_telegram_2fa(account_id, body.password, body.phoneCodeHash)
    except KeyError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    except Exception as exc:  # noqa: BLE001 — wrong password surfaces as nextStep=error
        logger.warning("Telegram 2FA failed for %s: %s", account_id, exc)
        await set_account_error(db, account_id, str(exc))
        return add_account_response(await get_account_row(db, account_id), "error")
    row = await get_account_row(db, account_id)
    return add_account_response_from_login(row, result)
