"""Telegram login flows (phone code / QR / optional 2FA)."""

from __future__ import annotations

from fastapi import Request

from server.api.deps import get_collector, get_db
from server.api.routes.sources.common import router
from server.api.schemas.requests.sources import (
    Telegram2faBody,
    TelegramCodeBody,
    TelegramCredentials,
    TelegramPatchBody,
    TelegramQrCredentials,
    TelegramQrWaitBody,
)
from server.api.schemas.responses import AddSourceResponse, UpdateTelegramSourceResponse
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries import sources_queries
from server.services.sources.credentials import merge_telegram_credentials
from server.services.sources.errors import SourceFlowError
from server.services.sources.route_helpers import get_source_row
from server.services.sources.telegram_login import (
    start_telegram_phone_login,
    start_telegram_qr_login,
    verify_telegram_2fa,
    verify_telegram_code,
    wait_telegram_qr_login,
)
from server.source_credentials import mutate_source_credentials
from server.util import utc_now_iso
from server.wire.serializer_domains.sources import serialize_source


def _raise_source_flow(exc: SourceFlowError) -> None:
    raise http_error(exc.http_status, str(exc), error_code=exc.error_code) from exc


@router.post(
    "/telegram",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def create_telegram_source(request: Request, body: TelegramCredentials) -> dict:
    return await start_telegram_phone_login(
        get_db(request),
        get_collector(request),
        api_id=body.apiId,
        api_hash=body.apiHash,
        phone=body.phone,
    )


@router.post(
    "/telegram/qr",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def create_telegram_source_qr(request: Request, body: TelegramQrCredentials) -> dict:
    return await start_telegram_qr_login(
        get_db(request),
        get_collector(request),
        api_id=body.apiId,
        api_hash=body.apiHash,
    )


@router.post(
    "/telegram/{source_id}/qr-wait",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def wait_telegram_qr(request: Request, source_id: str, body: TelegramQrWaitBody | None = None) -> dict:
    payload = body or TelegramQrWaitBody()
    try:
        return await wait_telegram_qr_login(
            get_db(request),
            get_collector(request),
            source_id,
            timeout_seconds=payload.timeoutSeconds,
        )
    except SourceFlowError as exc:
        _raise_source_flow(exc)


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
            lambda current: merge_telegram_credentials(
                current,
                api_id=body.apiId,
                api_hash=body.apiHash,
                phone=body.phone,
            ),
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
async def verify_telegram_code_route(request: Request, source_id: str, body: TelegramCodeBody) -> dict:
    try:
        return await verify_telegram_code(
            get_db(request),
            get_collector(request),
            source_id,
            code=body.code,
            phone_code_hash=body.phoneCodeHash,
        )
    except SourceFlowError as exc:
        _raise_source_flow(exc)


@router.post(
    "/telegram/{source_id}/verify-2fa",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def verify_telegram_2fa_route(request: Request, source_id: str, body: Telegram2faBody) -> dict:
    try:
        return await verify_telegram_2fa(
            get_db(request),
            get_collector(request),
            source_id,
            password=body.password,
            phone_code_hash=body.phoneCodeHash,
        )
    except SourceFlowError as exc:
        _raise_source_flow(exc)
