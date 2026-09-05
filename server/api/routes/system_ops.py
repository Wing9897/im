"""Authenticated system operations: collector status/restart, AI engine health,
emergency abort/pause, retention run, application restart.

Recovery endpoints (rotate-secrets, full reset) live in ``system_reset`` on a
separate public mount. "collector" naming is authoritative throughout the API.
"""

from __future__ import annotations

import logging
import os
import signal
import time

from fastapi import APIRouter, Request

from server.analysis_control import emergency_abort, set_analysis_paused
from server.api.collector_status import resolve_collector_status
from server.api.deps import (
    API_DEPS,
    get_analysis_engine,
    get_broadcaster,
    get_collector,
    get_db,
    get_scheduler,
)
from server.api.schemas.requests import AiEngineTestBody, AnalysisPauseBody
from server.api.schemas.responses import (
    AiEngineHealthStatusResponse,
    AiEngineTestResultResponse,
    AnalysisAbortResponse,
    AnalysisPauseResponse,
    CollectorAdapterStatusResponse,
    CollectorRestartResponse,
    CollectorStatusResponse,
    RetentionDeletedCounts,
    RetentionRunResponse,
    SystemMessageResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/system", tags=["system"], dependencies=API_DEPS)


async def _collector_status(request: Request) -> str:
    return await resolve_collector_status(get_collector(request))


@router.get("/collector/status", response_model=CollectorStatusResponse)
async def collector_status(request: Request) -> CollectorStatusResponse:
    status = await _collector_status(request)
    collector = get_collector(request)
    adapters: list[CollectorAdapterStatusResponse] = []
    if collector is not None:
        adapters.extend(
            CollectorAdapterStatusResponse(
                name=adapter.name,
                sourceId=adapter.source_id,
                connected=adapter.connected,
                lastError=adapter.last_error,
                lastConnectedAt=adapter.last_connected_at,
            )
            for adapter in collector.get_adapter_statuses()
        )
    return CollectorStatusResponse.model_validate({"status": status, "adapters": adapters})


@router.post("/collector/restart", response_model=CollectorRestartResponse)
async def collector_restart(request: Request) -> CollectorRestartResponse:
    previous = await _collector_status(request)
    collector = get_collector(request)
    if collector is None:
        from server.collector.manager import CollectorManager

        try:
            request.app.state.collector = await CollectorManager.create(get_db(request), get_broadcaster(request))
            return CollectorRestartResponse(message="Collector started", previousStatus=previous)
        except Exception as exc:  # noqa: BLE001 — report instead of 500
            logger.exception("Collector start failed")
            return CollectorRestartResponse(
                message=f"Collector start failed: {exc}",
                previousStatus=previous,
            )
    await collector.restart()
    return CollectorRestartResponse(message="Collector restarted", previousStatus=previous)


@router.get("/ai-engine/status", response_model=AiEngineHealthStatusResponse)
async def ai_engine_status(request: Request) -> AiEngineHealthStatusResponse:
    engine = get_analysis_engine(request)
    health = await engine.health_check()
    if health.get("status") == "ok":
        return AiEngineHealthStatusResponse(
            status="available",
            reason=None,
            provider=health.get("provider"),
            errorCode=None,
        )
    return AiEngineHealthStatusResponse(
        status="unavailable",
        reason=health.get("error"),
        provider=health.get("provider"),
        errorCode=health.get("error_code"),
    )


@router.post("/ai-engine/test", response_model=AiEngineTestResultResponse)
async def ai_engine_test(request: Request, body: AiEngineTestBody | None = None) -> AiEngineTestResultResponse:
    """Run a minimal-token generation probe against a profile-shaped draft (or bound slot)."""
    engine = get_analysis_engine(request)
    draft = body.model_dump(exclude_none=True) if body is not None else None
    started = time.monotonic()
    result = await engine.test_completion(draft)
    latency_ms = int((time.monotonic() - started) * 1000)
    return AiEngineTestResultResponse(
        success=bool(result.get("success")),
        provider=result.get("provider"),
        model=result.get("model"),
        latencyMs=latency_ms,
        promptTokens=int(result.get("prompt_tokens") or 0),
        completionTokens=int(result.get("completion_tokens") or 0),
        preview=result.get("preview"),
        error=result.get("error"),
        errorCode=result.get("error_code"),
    )


@router.post("/analysis/abort", response_model=AnalysisAbortResponse)
async def analysis_abort(request: Request) -> AnalysisAbortResponse:
    """Abort all in-flight batches and pause analysis."""
    result = await emergency_abort(get_db(request), get_scheduler(request))
    logger.info(
        "Emergency abort: %d batch(es) failed",
        len(result.get("abortedBatchIds", [])),
    )
    return AnalysisAbortResponse.model_validate(result)


@router.post("/analysis/pause", response_model=AnalysisPauseResponse)
async def analysis_pause(request: Request, body: AnalysisPauseBody) -> AnalysisPauseResponse:
    """Pause or resume the analysis scheduler (runtime control)."""
    paused = await set_analysis_paused(
        get_db(request),
        get_scheduler(request),
        paused=body.paused,
    )
    return AnalysisPauseResponse(analysisPaused=paused)


@router.post("/retention/run", response_model=RetentionRunResponse)
async def retention_run(request: Request) -> RetentionRunResponse:
    """Run one retention cleanup pass immediately; returns per-category delete counts."""
    from server.scheduler.retention import cleanup_expired_data

    counts = await cleanup_expired_data(get_db(request))
    deleted = RetentionDeletedCounts.model_validate(counts)
    deleted_total = sum(deleted.model_dump().values())
    return RetentionRunResponse(
        message=f"Retention cleanup complete ({deleted_total} rows deleted)",
        deleted=deleted,
    )


@router.post("/restart", response_model=SystemMessageResponse)
async def restart_application() -> SystemMessageResponse:
    """Exit the process; the Electron shell's process manager respawns it."""

    def _terminate() -> None:
        os.kill(os.getpid(), signal.SIGTERM)

    import asyncio

    asyncio.get_running_loop().call_later(0.5, _terminate)
    return SystemMessageResponse(message="Restarting")
