"""System routes: collector status/restart, AI engine health, emergency abort,
database/runtime reset, secrets rotate, application restart.

"collector" naming is authoritative throughout the API surface.
"""

from __future__ import annotations

import logging
import os
import signal
import time

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

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
from server.api.schemas.responses import RetentionDeletedCounts, RetentionRunResponse
from server.auth import verify_auth, verify_write_access
from server.auth.admin_auth import verify_admin_credentials
from server.errors import INVALID_CREDENTIALS, http_error
from server.paths import (
    clear_connection_json_files,
    clear_telegram_session_files,
)
from server.secrets import wipe_secret_key_files
from server.secrets_probe import probe_stored_secrets, scrub_undecryptable_secrets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/system", tags=["system"], dependencies=API_DEPS)
# Public mount for recovery endpoints allowlisted by RuntimeReadyMiddleware:
# rotate-secrets (data-preserving) and full reset (auth skipped when secrets broken).
public_reset_router = APIRouter(prefix="/api/v1/system", tags=["system"])


async def _refresh_secrets_gate(request: Request, db) -> tuple[bool, str | None]:
    """Re-probe stored secrets and start runtime when the gate can clear."""
    ready, err = await probe_stored_secrets(db)
    request.app.state.secrets_ready = ready
    request.app.state.secrets_error = err
    if not ready:
        return ready, err
    ensure = getattr(request.app.state, "ensure_runtime_started", None)
    if ensure is not None:
        try:
            await ensure()
        except Exception:  # noqa: BLE001 — gate must clear even if services lag
            logger.exception("Starting runtime services after secrets recovery failed")
    return ready, err


async def _collector_status(request: Request) -> str:
    return await resolve_collector_status(get_collector(request))


@router.get("/collector/status")
async def collector_status(request: Request) -> dict:
    status = await _collector_status(request)
    collector = get_collector(request)
    adapters = []
    if collector is not None:
        for adapter in collector.get_adapter_statuses():
            adapters.append(
                {
                    "name": adapter.name,
                    "accountId": adapter.account_id,
                    "connected": adapter.connected,
                    "lastError": adapter.last_error,
                    "lastConnectedAt": adapter.last_connected_at,
                }
            )
    return {"status": status, "adapters": adapters}


@router.post("/collector/restart")
async def collector_restart(request: Request) -> dict:
    previous = await _collector_status(request)
    collector = get_collector(request)
    if collector is None:
        from server.collector.manager import CollectorManager

        try:
            request.app.state.collector = await CollectorManager.create(get_db(request), get_broadcaster(request))
            return {"message": "Collector started", "previousStatus": previous}
        except Exception as exc:  # noqa: BLE001 — report instead of 500
            logger.exception("Collector start failed")
            return {
                "message": f"Collector start failed: {exc}",
                "previousStatus": previous,
            }
    await collector.restart()
    return {"message": "Collector restarted", "previousStatus": previous}


@router.get("/ai-engine/status")
async def ai_engine_status(request: Request) -> dict:
    engine = get_analysis_engine(request)
    health = await engine.health_check()
    if health.get("status") == "ok":
        return {
            "status": "available",
            "reason": None,
            "provider": health.get("provider"),
        }
    return {
        "status": "unavailable",
        "reason": health.get("error"),
        "provider": health.get("provider"),
    }


class AiEngineTestBody(BaseModel):
    llmProvider: str | None = None
    llmBaseUrl: str | None = None
    llmModel: str | None = None
    llmApiKey: str | None = None
    ollamaThinkingEnabled: bool | None = None


@router.post("/ai-engine/test")
async def ai_engine_test(request: Request, body: AiEngineTestBody | None = None) -> dict:
    """Run a minimal-token generation probe against saved or draft LLM settings."""
    engine = get_analysis_engine(request)
    draft = body.model_dump(exclude_none=True) if body is not None else None
    started = time.monotonic()
    result = await engine.test_completion(draft)
    latency_ms = int((time.monotonic() - started) * 1000)
    return {
        "success": bool(result.get("success")),
        "provider": result.get("provider"),
        "model": result.get("model"),
        "latencyMs": latency_ms,
        "promptTokens": int(result.get("prompt_tokens") or 0),
        "completionTokens": int(result.get("completion_tokens") or 0),
        "preview": result.get("preview"),
        "error": result.get("error"),
    }


@router.post("/analysis/abort")
async def analysis_abort(request: Request) -> dict:
    """Abort all in-flight batches and pause analysis."""
    result = await emergency_abort(get_db(request), get_scheduler(request))
    logger.info(
        "Emergency abort: %d batch(es) failed",
        len(result.get("abortedBatchIds", [])),
    )
    return result


class AnalysisPauseBody(BaseModel):
    paused: bool


@router.post("/analysis/pause")
async def analysis_pause(request: Request, body: AnalysisPauseBody) -> dict:
    """Pause or resume the analysis scheduler (runtime control)."""
    paused = await set_analysis_paused(
        get_db(request),
        get_scheduler(request),
        paused=body.paused,
    )
    return {"analysisPaused": paused}


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


class RotateSecretsBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1)


@public_reset_router.post("/rotate-secrets")
async def rotate_secrets(request: Request, body: RotateSecretsBody) -> dict:
    """Rotate ``secret.key`` and scrub undecryptable ciphertext; keep business data.

    Only allowed while ``secrets_ready`` is False. Requires admin username +
    password. Does not wipe the database, connection.json, or admin accounts.
    """
    secrets_ready = bool(getattr(request.app.state, "secrets_ready", True))
    if secrets_ready:
        raise http_error(
            409,
            "Secrets are already ready; rotate is only allowed when the encryption key cannot decrypt stored secrets",
        )

    db = get_db(request)
    admin = await verify_admin_credentials(
        db,
        username=body.username,
        password=body.password,
    )
    if admin is None:
        raise http_error(
            401,
            "Invalid username or password",
            error_code=INVALID_CREDENTIALS,
        )

    try:
        wipe_secret_key_files()
    except Exception:  # noqa: BLE001 — still scrub so probe can clear the gate
        logger.exception("Clearing secret.key during rotate-secrets failed")

    scrubbed = await scrub_undecryptable_secrets(db)

    try:
        clear_telegram_session_files()
    except Exception:  # noqa: BLE001 — credentials are scrubbed; sessions are best-effort
        logger.exception("Clearing Telegram session files during rotate-secrets failed")

    ready, _err = await _refresh_secrets_gate(request, db)
    return {
        "message": "Secrets rotated",
        "secretsReady": ready,
        "scrubbed": scrubbed,
    }


@public_reset_router.post("/reset/database")
async def reset_database(request: Request) -> dict:
    """Full wipe: rebuild schema and clear every local runtime artifact.

    Removes SQLite data, Telegram sessions, ``secret.key``, and
    ``connection.json``. Clients clear local auth/cache and relaunch into
    FirstRunWizard after this.

    When ``secrets_ready`` is already False (key mismatch), auth is skipped so
    CLI / Settings recovery can wipe without a usable session. Otherwise normal
    API_DEPS semantics apply. The secrets gate UI prefers rotate-secrets instead.
    """
    secrets_ready = bool(getattr(request.app.state, "secrets_ready", True))
    if secrets_ready:
        await verify_auth(request)
        await verify_write_access(request)

    db = get_db(request)
    scheduler = get_scheduler(request)
    collector = get_collector(request)
    if scheduler is not None:
        await scheduler.pause()
    if collector is not None:
        await collector.shutdown()
    await db._rebuild_file()  # noqa: SLF001 — deliberate full reset
    # Sidecar files live on disk (not in SQLite); wipe leftovers so post-reset
    # login cannot reuse stale auth / encryption / shell connection state.
    try:
        clear_telegram_session_files()
    except Exception:  # noqa: BLE001 — reset must still succeed if disk cleanup fails
        logger.exception("Clearing Telegram session files after database reset failed")
    try:
        wipe_secret_key_files()
    except Exception:  # noqa: BLE001
        logger.exception("Clearing secret.key after database reset failed")
    try:
        clear_connection_json_files()
    except Exception:  # noqa: BLE001
        logger.exception("Clearing connection.json after database reset failed")

    # Re-probe so the secrets gate clears without requiring a process restart.
    await _refresh_secrets_gate(request, db)

    if scheduler is not None:
        await scheduler.resume()
    if collector is not None:
        try:
            await collector.start()
        except Exception:  # noqa: BLE001 — collector restart is best-effort
            logger.exception("Collector restart after database reset failed")
    return {"message": "Database reset complete"}


@router.post("/restart")
async def restart_application() -> dict:
    """Exit the process; the Electron shell's process manager respawns it."""

    def _terminate() -> None:
        os.kill(os.getpid(), signal.SIGTERM)

    import asyncio

    asyncio.get_running_loop().call_later(0.5, _terminate)
    return {"message": "Restarting"}
