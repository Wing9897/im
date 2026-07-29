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
    lifecycle = getattr(request.app.state, "schema_lifecycle", None)
    if lifecycle is None:
        return {"status": "ok", "version": __version__, "runtimeReady": True}

    snap = lifecycle.snapshot()
    # Desktop treats any of these as "server is up" so the upgrade UI can load.
    if snap["state"] == "ready":
        status = "ok"
    elif snap["state"] in ("needs_upgrade", "migrating"):
        status = snap["state"]
    else:
        status = "upgrade_failed"

    return {
        "status": status,
        "version": __version__,
        "runtimeReady": snap["runtimeReady"],
        "schema": snap,
    }
