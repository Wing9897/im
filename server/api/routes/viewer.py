"""Viewer routes: read-only subset for remote LAN clients."""

from __future__ import annotations

import time

from fastapi import APIRouter, Request

from server.api.collector_status import resolve_collector_status
from server.api.deps import API_DEPS, get_collector, get_db, get_scheduler
from server.api.schemas.responses import (
    ViewerStatsResponse,
    ViewerStatusResponse,
    ViewerTaskResponse,
)
from server.config import get_config_bool
from server.queries.batch_stats import count_pending_current_batches
from server.queries.viewer_queries import fetch_viewer_stats, fetch_viewer_tasks

router = APIRouter(prefix="/api/v1/viewer", tags=["viewer"], dependencies=API_DEPS)

_STARTED_AT = time.monotonic()


@router.get("/stats", response_model=ViewerStatsResponse)
async def viewer_stats(request: Request) -> dict:
    """Aggregate stats. Result counts are version-aware (matching results.py)."""
    return await fetch_viewer_stats(get_db(request))


@router.get("/status", response_model=ViewerStatusResponse)
async def viewer_status(request: Request) -> dict:
    db = get_db(request)
    scheduler = get_scheduler(request)
    collector_alive = (await resolve_collector_status(get_collector(request))) == "running"
    pending = await count_pending_current_batches(db)
    return {
        "queueDepth": pending + (scheduler.queue_size if scheduler else 0),
        "collectorAlive": collector_alive,
        "analysisPaused": await get_config_bool(db, "analysis_paused"),
        "uptimeSeconds": int(time.monotonic() - _STARTED_AT),
    }


@router.get(
    "/tasks",
    response_model=list[ViewerTaskResponse],
    response_model_exclude_none=True,
)
async def viewer_tasks(request: Request) -> list[dict]:
    return await fetch_viewer_tasks(get_db(request))
