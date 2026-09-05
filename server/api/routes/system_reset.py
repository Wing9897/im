"""Recovery endpoints on a public mount: secrets rotate and full database reset.

Both are allowlisted by ``RuntimeReadyMiddleware`` so they stay reachable while
the secrets gate is closed. Auth is enforced inside each handler (admin
credentials for rotate; normal auth for reset unless secrets are already broken).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request

from server.api.deps import get_collector, get_db, get_scheduler
from server.api.schemas.requests import RotateSecretsBody
from server.api.schemas.responses import (
    RotateSecretsResponse,
    RotateSecretsScrubbedCounts,
    SystemMessageResponse,
)
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

# No API_DEPS here: the handlers gate themselves (see module docstring).
router = APIRouter(prefix="/api/v1/system", tags=["system"])


async def _refresh_secrets_gate(request: Request, db) -> tuple[bool, str | None, bool]:
    """Re-probe stored secrets and start runtime when the gate can clear.

    Returns ``(secrets_ready, secrets_error, runtime_started)``. The gate still
    clears when startup fails, but ``runtime_started`` stays False so callers
    report it instead of letting the UI assume a healthy runtime.
    """
    ready, err = await probe_stored_secrets(db)
    request.app.state.secrets_ready = ready
    request.app.state.secrets_error = err
    if not ready:
        return ready, err, False
    ensure = getattr(request.app.state, "ensure_runtime_started", None)
    if ensure is None:
        return ready, err, True
    try:
        await ensure()
    except Exception:  # noqa: BLE001 — reported via runtime_started, not raised
        logger.exception("Starting runtime services after secrets recovery failed")
        return ready, err, False
    return ready, err, True


@router.post("/rotate-secrets", response_model=RotateSecretsResponse)
async def rotate_secrets(request: Request, body: RotateSecretsBody) -> RotateSecretsResponse:
    """Rotate ``secret.key`` and scrub undecryptable ciphertext; keep business data.

    Only allowed while ``secrets_ready`` is False. Requires admin username +
    password. Does not wipe the database, connection.json, or admin sources.
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

    # Abort before scrubbing: a surviving secret.key would silently keep the
    # unusable encryption key on disk while the ciphertext is already gone.
    try:
        wipe_secret_key_files()
    except Exception as exc:
        logger.exception("Clearing secret.key during rotate-secrets failed")
        raise http_error(
            500,
            f"Could not delete the old secret.key, so rotation was aborted and no data was changed: {exc}",
        ) from exc

    scrubbed = RotateSecretsScrubbedCounts.model_validate(await scrub_undecryptable_secrets(db))

    try:
        clear_telegram_session_files()
    except Exception:  # noqa: BLE001 — credentials are scrubbed; sessions are best-effort
        logger.exception("Clearing Telegram session files during rotate-secrets failed")

    ready, _err, runtime_started = await _refresh_secrets_gate(request, db)
    return RotateSecretsResponse(
        message=(
            "Secrets rotated"
            if runtime_started
            else "Secrets rotated, but background services failed to start; restart the application"
        ),
        secretsReady=ready,
        runtimeStarted=runtime_started,
        scrubbed=scrubbed,
    )


@router.post("/reset/database", response_model=SystemMessageResponse)
async def reset_database(request: Request) -> SystemMessageResponse:
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
    await db.rebuild_current_schema()
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
    return SystemMessageResponse(message="Database reset complete")
