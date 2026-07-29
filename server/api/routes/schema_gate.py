"""Public schema upgrade gate endpoints (no auth — local desktop bootstrap)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.schemas.responses import SchemaUpgradeStatusResponse
from server.errors import SCHEMA_UPGRADE_REQUIRED, http_error

router = APIRouter(prefix="/api/v1/system/schema", tags=["schema"])


def _lifecycle(request: Request) -> Any:
    lifecycle = getattr(request.app.state, "schema_lifecycle", None)
    if lifecycle is None:
        raise http_error(
            503,
            "Schema lifecycle not initialized",
            error_code=SCHEMA_UPGRADE_REQUIRED,
        )
    return lifecycle


@router.get("/status", response_model=SchemaUpgradeStatusResponse)
async def schema_status(request: Request) -> SchemaUpgradeStatusResponse:
    return _lifecycle(request).snapshot()


@router.post("/upgrade", response_model=SchemaUpgradeStatusResponse)
async def schema_upgrade(request: Request) -> SchemaUpgradeStatusResponse:
    """Run stop-the-world backup + migration + runtime start."""
    return await _lifecycle(request).run_upgrade()
