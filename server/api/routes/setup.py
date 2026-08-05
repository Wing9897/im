"""First-run admin registration, password login, and device session routes.

Public (no ``API_DEPS``): status, register, login, reset-password, refresh.
Authenticated: change-password, logout, devices list/revoke.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.deps import API_DEPS, get_db
from server.api.schemas.requests import (
    ChangePasswordBody,
    LoginBody,
    RefreshBody,
    RegisterBody,
    ResetPasswordBody,
)
from server.api.schemas.responses import DeviceSessionTokensResponse, SetupStatusResponse
from server.auth import is_loopback, presented_token
from server.auth.access_keys import is_valid_access_token
from server.auth.admin_auth import (
    AdminAuthError,
    create_admin_account,
    get_admin_by_username,
    get_admin_row,
    has_admin_account,
    update_admin_password,
    validate_password,
    validate_username,
    verify_admin_credentials,
    verify_password,
)
from server.auth.device_auth import (
    create_device_session,
    credentials_configured,
    has_active_device_session,
    is_bootstrapped,
    list_devices,
    mark_household_secured,
    refresh_device_session,
    resolve_session_id_for_access_token,
    revoke_session,
    revoke_session_for_access_token,
)
from server.config import get_config_bool
from server.connection_file import (
    disarm_local_password_reset,
    is_local_password_reset_armed,
)
from server.errors import (
    ADMIN_EXISTS,
    FORBIDDEN,
    INVALID_CREDENTIALS,
    INVALID_REFRESH_TOKEN,
    NOT_BOOTSTRAPPED,
    NOT_FOUND,
    VALIDATION_ERROR,
    http_error,
)

router = APIRouter(prefix="/api/v1/setup", tags=["setup"])


def _validation_error(exc: AdminAuthError) -> Exception:
    return http_error(422, str(exc), error_code=VALIDATION_ERROR)


@router.get("/status", response_model=SetupStatusResponse)
async def setup_status(request: Request) -> dict[str, Any]:
    db = get_db(request)
    admin = await has_admin_account(db)
    return {
        "bootstrapped": await is_bootstrapped(db),
        "hasAdmin": admin,
        "hasActiveDevice": await has_active_device_session(db),
        "credentialsConfigured": await credentials_configured(db),
        "localhostAuthExempt": await get_config_bool(db, "localhost_auth_exempt"),
        "resetPasswordForLocal": is_local_password_reset_armed(),
    }


@router.post("/register", response_model=DeviceSessionTokensResponse)
async def setup_register(request: Request, body: RegisterBody) -> dict[str, Any]:
    """Create the singleton admin and first device session (loopback only)."""
    if not is_loopback(request):
        raise http_error(
            403,
            "Admin registration is only allowed from localhost",
            error_code=FORBIDDEN,
        )
    db = get_db(request)
    if await has_admin_account(db):
        raise http_error(
            409,
            "Admin account already exists",
            error_code=ADMIN_EXISTS,
        )
    try:
        validate_username(body.username)
        validate_password(body.password)
    except AdminAuthError as exc:
        raise _validation_error(exc) from exc

    await create_admin_account(db, username=body.username, password=body.password)
    tokens = await create_device_session(db, label=body.label or "Host")
    await mark_household_secured(db)
    return tokens


@router.post("/login", response_model=DeviceSessionTokensResponse)
async def setup_login(request: Request, body: LoginBody) -> dict[str, Any]:
    db = get_db(request)
    if not await is_bootstrapped(db):
        raise http_error(
            409,
            "Server is not bootstrapped yet",
            error_code=NOT_BOOTSTRAPPED,
        )
    admin = await verify_admin_credentials(
        db,
        username=body.username,
        password=body.password,
    )
    if admin is None:
        raise http_error(
            401,
            "Invalid username or password",
            error_code=INVALID_CREDENTIALS,
        )
    tokens = await create_device_session(db, label=body.label or "Device")
    await mark_household_secured(db)
    return tokens


@router.post("/change-password", dependencies=API_DEPS)
async def setup_change_password(request: Request, body: ChangePasswordBody) -> dict[str, bool]:
    db = get_db(request)
    if not await is_bootstrapped(db):
        raise http_error(
            409,
            "Server is not bootstrapped yet",
            error_code=NOT_BOOTSTRAPPED,
        )
    try:
        validate_password(body.newPassword)
    except AdminAuthError as exc:
        raise _validation_error(exc) from exc

    row = await get_admin_row(db)
    if row is None:
        raise http_error(
            409,
            "Server is not bootstrapped yet",
            error_code=NOT_BOOTSTRAPPED,
        )
    if not verify_password(str(row["password_hash"]), body.currentPassword):
        raise http_error(
            401,
            "Invalid current password",
            error_code=INVALID_CREDENTIALS,
        )
    await update_admin_password(db, new_password=body.newPassword)
    return {"ok": True}


@router.post("/reset-password")
async def setup_reset_password(request: Request, body: ResetPasswordBody) -> dict[str, bool]:
    """Reset admin password without the old one (loopback + file-armed rescue)."""
    if not is_loopback(request):
        raise http_error(
            403,
            "Password reset is only allowed from localhost",
            error_code=FORBIDDEN,
        )
    if not is_local_password_reset_armed():
        raise http_error(
            403,
            "Local password reset is disabled. Set resetPasswordForLocal to true in "
            "connection.json under the data directory, then retry.",
            error_code=FORBIDDEN,
        )
    db = get_db(request)
    if not await is_bootstrapped(db):
        raise http_error(
            409,
            "Server is not bootstrapped yet",
            error_code=NOT_BOOTSTRAPPED,
        )
    try:
        clean_username = validate_username(body.username)
        validate_password(body.newPassword)
    except AdminAuthError as exc:
        raise _validation_error(exc) from exc

    row = await get_admin_by_username(db, clean_username)
    if row is None:
        raise http_error(
            401,
            "Invalid username or password",
            error_code=INVALID_CREDENTIALS,
        )
    await update_admin_password(db, new_password=body.newPassword)
    # One-shot arming: require re-editing the file for the next rescue.
    disarm_local_password_reset()
    return {"ok": True}


@router.post("/refresh", response_model=DeviceSessionTokensResponse)
async def setup_refresh(request: Request, body: RefreshBody) -> dict[str, Any]:
    db = get_db(request)
    tokens = await refresh_device_session(db, body.refreshToken)
    if tokens is None:
        raise http_error(
            401,
            "Invalid or expired refresh token",
            error_code=INVALID_REFRESH_TOKEN,
        )
    return tokens


@router.post("/logout", dependencies=API_DEPS)
async def setup_logout(request: Request) -> dict[str, bool]:
    db = get_db(request)
    token = presented_token(request)
    # API-key callers have no device session to revoke; treat as success no-op.
    if await is_valid_access_token(db, token):
        return {"ok": True}
    revoked = await revoke_session_for_access_token(db, token)
    if not revoked:
        raise http_error(401, "Invalid or missing device access token")
    return {"ok": True}


@router.get("/devices", dependencies=API_DEPS)
async def setup_list_devices(request: Request) -> dict[str, Any]:
    db = get_db(request)
    current = await resolve_session_id_for_access_token(db, presented_token(request))
    return {"devices": await list_devices(db, current_session_id=current)}


@router.delete("/devices/{device_id}", dependencies=API_DEPS)
async def setup_revoke_device(request: Request, device_id: str) -> dict[str, bool]:
    db = get_db(request)
    removed = await revoke_session(db, device_id.strip())
    if not removed:
        raise http_error(404, "Device not found", error_code=NOT_FOUND)
    return {"ok": True}
