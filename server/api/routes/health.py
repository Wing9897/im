"""Public health endpoints (no auth).

Primary consumer: ``GET /api/v1/health`` (Electron, dev scripts, verify).
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from server import __version__
from server.constants import HOST_ENV
from server.db.schema_bootstrap import CURRENT_SCHEMA_VERSION, SCHEMA_SEMVER

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str
    runtimeReady: bool
    secretsReady: bool
    secretsError: str | None = None
    schemaVersion: int
    schemaSemver: str
    #: Effective uvicorn bind host (default ``127.0.0.1``; LAN uses ``0.0.0.0``).
    bindHost: str
    #: True when bound beyond loopback (LAN / all-interfaces).
    lanAccessEnabled: bool


@router.get("/api/v1/health", response_model=HealthResponse)
async def health_v1(request: Request) -> dict[str, Any]:
    secrets_ready = bool(getattr(request.app.state, "secrets_ready", True))
    secrets_error = getattr(request.app.state, "secrets_error", None)
    bind_host = os.environ.get(HOST_ENV, "127.0.0.1").strip() or "127.0.0.1"
    payload: dict[str, Any] = {
        "status": "ok",
        "version": __version__,
        # Process is up; business APIs may still be gated by secrets (see runtime_ready).
        "runtimeReady": True,
        "secretsReady": secrets_ready,
        "schemaVersion": CURRENT_SCHEMA_VERSION,
        "schemaSemver": SCHEMA_SEMVER,
        "bindHost": bind_host,
        "lanAccessEnabled": bind_host not in {"127.0.0.1", "::1", "localhost"},
    }
    if secrets_error:
        payload["secretsError"] = str(secrets_error)
    return payload
