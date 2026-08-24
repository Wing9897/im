"""Public health endpoints (no auth).

Primary consumer: ``GET /api/v1/health`` (Electron, dev scripts, verify).
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Request

from server import __version__
from server.api.schemas.responses import HealthResponse
from server.constants import DEFAULT_BIND_HOST, HOST_ENV
from server.db.schema_inspect import CURRENT_SCHEMA_VERSION, SCHEMA_SEMVER

router = APIRouter(tags=["health"])


@router.get("/api/v1/health", response_model=HealthResponse)
async def health_v1(request: Request) -> HealthResponse:
    secrets_ready = bool(getattr(request.app.state, "secrets_ready", True))
    secrets_error = getattr(request.app.state, "secrets_error", None)
    bind_host = os.environ.get(HOST_ENV, DEFAULT_BIND_HOST).strip() or DEFAULT_BIND_HOST
    return HealthResponse(
        status="ok",
        version=__version__,
        # Process is up; business APIs may still be gated by secrets (see runtime_ready).
        runtimeReady=True,
        secretsReady=secrets_ready,
        secretsError=str(secrets_error) if secrets_error else None,
        schemaVersion=CURRENT_SCHEMA_VERSION,
        schemaSemver=SCHEMA_SEMVER,
        bindHost=bind_host,
    )
