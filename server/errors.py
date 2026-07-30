"""Structured error responses.

The frontend (`web/src/api/parseApiError.ts`) prefers the structured body
``{error_code, message, details, correlation_id}`` — snake_case by contract.

503 codes are scenario-specific when callers set ``error_code``; the status
default remains ``COLLECTOR_UNAVAILABLE``. 401s must carry ``AUTH_REQUIRED``
(ErrorToast shortcut). Remote read-only 403s use ``FORBIDDEN``.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, cast

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

AUTH_REQUIRED = "AUTH_REQUIRED"
AUTH_SETUP_REQUIRED = "AUTH_SETUP_REQUIRED"
FORBIDDEN = "FORBIDDEN"
NOT_FOUND = "NOT_FOUND"
VALIDATION_ERROR = "VALIDATION_ERROR"
INTERNAL_ERROR = "INTERNAL_ERROR"
COLLECTOR_UNAVAILABLE = "COLLECTOR_UNAVAILABLE"
SCHEMA_UPGRADE_REQUIRED = "SCHEMA_UPGRADE_REQUIRED"
SECRETS_UNAVAILABLE = "SECRETS_UNAVAILABLE"
SSE_CAPACITY = "SSE_CAPACITY"
ADMIN_EXISTS = "ADMIN_EXISTS"
NOT_BOOTSTRAPPED = "NOT_BOOTSTRAPPED"
INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
INVALID_REFRESH_TOKEN = "INVALID_REFRESH_TOKEN"

_STATUS_TO_CODE = {
    400: VALIDATION_ERROR,
    401: AUTH_REQUIRED,
    403: FORBIDDEN,
    404: NOT_FOUND,
    409: VALIDATION_ERROR,
    422: VALIDATION_ERROR,
    503: COLLECTOR_UNAVAILABLE,
}


def error_body(
    status: int,
    message: str,
    *,
    error_code: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "error_code": error_code or _STATUS_TO_CODE.get(status, INTERNAL_ERROR),
        "message": message,
        "details": details,
        "correlation_id": uuid.uuid4().hex,
    }


def http_error(
    status: int,
    message: str,
    *,
    error_code: str | None = None,
    details: dict[str, Any] | None = None,
) -> HTTPException:
    """Build an HTTPException whose detail carries a structured error code."""
    return HTTPException(
        status_code=status,
        detail={
            "error_code": error_code or _STATUS_TO_CODE.get(status, INTERNAL_ERROR),
            "message": message,
            "details": details,
        },
    )


def _body_from_http_exception(exc: HTTPException) -> dict[str, Any]:
    detail = cast(Any, exc.detail)
    message = detail.get("message") if isinstance(detail, dict) else None
    if isinstance(message, str):
        code = detail.get("error_code")
        code_str = code if isinstance(code, str) and code else None
        details = detail.get("details")
        details_dict = details if isinstance(details, dict) else None
        return error_body(
            exc.status_code,
            message,
            error_code=code_str,
            details=details_dict,
        )
    message = detail if isinstance(detail, str) else str(detail)
    return error_body(exc.status_code, message)


def register_error_handlers(app: FastAPI) -> None:
    from server.secrets import SecretProtectionError

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_body_from_http_exception(exc),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=error_body(
                422,
                "Request validation failed",
                details={"errors": jsonable_encoder(exc.errors())},
            ),
        )

    @app.exception_handler(SecretProtectionError)
    async def secret_protection_handler(request: Request, exc: SecretProtectionError) -> JSONResponse:
        logger.error(
            "Secret protection failure on %s %s: %s",
            request.method,
            request.url.path,
            exc,
        )
        return JSONResponse(
            status_code=503,
            content=error_body(
                503,
                "Local encryption key cannot decrypt stored secrets",
                error_code=SECRETS_UNAVAILABLE,
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled exception on %s %s",
            request.method,
            request.url.path,
            exc_info=exc,
        )
        return JSONResponse(status_code=500, content=error_body(500, "Internal server error"))
