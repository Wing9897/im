"""Wire bodies for Telegram login steps and reconnect."""

from __future__ import annotations

from typing import Any

from server.wire.serializer_domains.sources import serialize_source


def add_source_response(
    source_row: dict[str, Any],
    next_step: str,
    phone_code_hash: str | None = None,
    *,
    qr_url: str | None = None,
    qr_expires_at: str | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "source": serialize_source(source_row),
        "nextStep": next_step,
    }
    if next_step in ("code_required", "2fa_required", "qr_required"):
        response["pendingLoginStage"] = next_step
    if phone_code_hash is not None:
        response["phoneCodeHash"] = phone_code_hash
    if qr_url is not None:
        response["qrUrl"] = qr_url
    if qr_expires_at is not None:
        response["qrExpiresAt"] = qr_expires_at
    return response


def add_source_response_from_login(source_row: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    return add_source_response(
        source_row,
        str(result.get("next_step") or "error"),
        result.get("phone_code_hash"),
        qr_url=result.get("qr_url"),
        qr_expires_at=result.get("qr_expires_at"),
    )
