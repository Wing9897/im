"""Public health endpoints (no auth).

Primary consumer: ``GET /api/v1/health`` (Electron, dev scripts, verify).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server import __version__

router = APIRouter(tags=["health"])


@router.get("/api/v1/health")
async def health_v1(request: Request) -> dict[str, Any]:
    secrets_ready = bool(getattr(request.app.state, "secrets_ready", True))
    secrets_error = getattr(request.app.state, "secrets_error", None)
    lifecycle = getattr(request.app.state, "schema_lifecycle", None)
    if lifecycle is None:
        payload: dict[str, Any] = {
            "status": "ok",
            "version": __version__,
            "runtimeReady": True,
            "secretsReady": secrets_ready,
        }
        if secrets_error:
            payload["secretsError"] = str(secrets_error)
        return payload

    snap = lifecycle.snapshot()
    # Desktop treats any of these as "server is up" so the upgrade UI can load.
    # secretsReady=false must NOT flip this into a "server down" signal.
    if snap["state"] == "ready":
        status = "ok"
    elif snap["state"] in ("needs_upgrade", "migrating"):
        status = snap["state"]
    else:
        status = "upgrade_failed"

    payload = {
        "status": status,
        "version": __version__,
        "runtimeReady": snap["runtimeReady"],
        "secretsReady": secrets_ready,
        "schema": snap,
    }
    if secrets_error:
        payload["secretsError"] = str(secrets_error)
    return payload
