"""Calendar-share remote error types and HTTP status mapping."""

from __future__ import annotations

from typing import Any, NoReturn

from server.errors import (
    AUTH_REQUIRED,
    CALENDAR_EVENT_LIMIT,
    CALENDAR_SHARE_REQUEST_FAILED,
    CALENDAR_SHARE_UNREACHABLE,
    NOT_FOUND,
    PUBLISH_CALENDAR_LIMIT,
    RATE_LIMITED,
    SUBSCRIBE_LIMIT,
    VALIDATION_ERROR,
    http_error,
)

IC_QUOTA_ERROR_CODES = frozenset({PUBLISH_CALENDAR_LIMIT, SUBSCRIBE_LIMIT, CALENDAR_EVENT_LIMIT})


class CalendarShareRemoteError(Exception):
    """Remote calendar server returned a non-success status."""

    def __init__(self, status: int, message: str, payload: Any = None, *, error_code: str | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.message = message
        self.payload = payload
        self.error_code = (
            error_code
            or _error_code_from_payload(payload)
            or (CALENDAR_SHARE_UNREACHABLE if status == 502 else CALENDAR_SHARE_REQUEST_FAILED)
        )


def _error_code_from_payload(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    code = payload.get("error_code")
    if isinstance(code, str) and code.strip():
        return code.strip()
    detail = payload.get("detail")
    if isinstance(detail, dict):
        nested = detail.get("error_code")
        if isinstance(nested, str) and nested.strip():
            return nested.strip()
    return None


def _message_from_payload(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        for key in ("message", "detail", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                nested = value.get("message")
                if isinstance(nested, str) and nested.strip():
                    return nested.strip()
            if isinstance(value, list) and value:
                first = value[0]
                if isinstance(first, str) and first.strip():
                    return first.strip()
                if isinstance(first, dict):
                    nested = first.get("msg") or first.get("message")
                    if isinstance(nested, str) and nested.strip():
                        return nested.strip()
        if isinstance(payload.get("error_code"), str) and payload["error_code"].strip():
            return payload["error_code"].strip()
    if isinstance(payload, str) and payload.strip():
        return payload.strip()
    if isinstance(payload, list) and payload:
        return _message_from_payload({"detail": payload}, fallback)
    return fallback


def raise_remote_status(
    status: int,
    payload: Any,
    *,
    fallback_code: str = CALENDAR_SHARE_REQUEST_FAILED,
    fallback: str | None = None,
) -> NoReturn:
    """Raise a structured HTTP error. Protocol identity is ``error_code``, not English copy."""
    payload_code = _error_code_from_payload(payload)
    message = _message_from_payload(payload, fallback or payload_code or fallback_code)
    if status == 401:
        raise http_error(401, message, error_code=AUTH_REQUIRED)
    if status == 403:
        raise http_error(403, message, error_code=payload_code or fallback_code)
    if status == 404:
        raise http_error(404, message, error_code=NOT_FOUND)
    if status == 409:
        raise http_error(409, message, error_code=VALIDATION_ERROR)
    if status == 429:
        raise http_error(429, message, error_code=RATE_LIMITED)
    if 400 <= status < 500:
        raise http_error(
            422 if status == 400 else status,
            message,
            error_code=payload_code if payload_code in IC_QUOTA_ERROR_CODES else VALIDATION_ERROR,
        )
    raise http_error(502, message, error_code=payload_code or fallback_code)


def raise_mapped_remote_error(exc: CalendarShareRemoteError) -> NoReturn:
    """Map a transport/remote exception through ``raise_remote_status``."""
    raise_remote_status(
        exc.status,
        exc.payload,
        fallback_code=exc.error_code or CALENDAR_SHARE_UNREACHABLE,
        fallback=exc.message,
    )
