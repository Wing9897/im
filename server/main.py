"""FastAPI application factory + lifespan startup sequence.

Startup order:
    1. Database connect + classify schema (upgrade gate if pending).
    2. If schema current: ensure_schema + data migrations + orphan recovery +
       scheduler + collector.
    3. If schema needs upgrade: HTTP comes up in gate mode (no collector /
       scheduler) until ``POST /api/v1/system/schema/upgrade`` succeeds.

Schema support matrix and upgrade-gate policy: ``docs/ARCHITECTURE.md``.

Unlike the previous rebuild, CORS and production static-file serving are wired
here from day one — their absence was a root cause of the packaged app
failing to load.
"""

from __future__ import annotations

import asyncio
import logging
import os
from asyncio import CancelledError
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server import __version__
from server.api.routes import all_routers
from server.constants import (
    DB_PATH_ENV,
    SERVICE_PORT,
    STARTUP_DB_SETTLE_SECONDS,
)
from server.db.database import Database, SchemaBaselineError
from server.db.migrations import inspect_schema, migration_pending
from server.http_limits import (
    MAX_REQUEST_BODY_BYTES,
    RateLimitMiddleware,
    RequestBodyLimitMiddleware,
)
from server.paths import default_db_path, ensure_data_dir
from server.runtime_ready import RuntimeReadyMiddleware
from server.schema_lifecycle import SchemaLifecycle
from server.sse import SseBroadcaster
from server.static_files import mount_static_files

logger = logging.getLogger(__name__)


def _resolve_db_path(db_path: Optional[str]) -> str:
    env = os.environ.get(DB_PATH_ENV, "").strip()
    if db_path:
        return db_path
    if env:
        return env
    ensure_data_dir()
    return str(default_db_path())


async def _start_runtime_services(
    app: FastAPI,
    db: Database,
    *,
    start_collector: bool,
    start_scheduler: bool,
) -> asyncio.Task[None]:
    """Start scheduler/collector and return the geocode backfill task."""
    from server.db.data_migrations import apply_data_migrations

    await apply_data_migrations(db)

    broadcaster: SseBroadcaster = app.state.broadcaster

    from server.actions import ActionExecutor

    action_executor = ActionExecutor(db)
    app.state.action_executor = action_executor

    from server.analyzer.engine import AnalysisEngine

    analysis_engine = AnalysisEngine(db)
    app.state.analysis_engine = analysis_engine

    from server.scheduler.manager import SchedulerManager

    scheduler = SchedulerManager(db, analysis_engine, broadcaster, action_executor)
    app.state.scheduler = scheduler

    if start_scheduler:
        await scheduler.recover_orphan_batches()
        await scheduler.start()

    collector: Optional[Any] = None
    if start_collector:
        try:
            from server.collector.manager import CollectorManager

            collector = await CollectorManager.create(db, broadcaster)
        except Exception as exc:  # noqa: BLE001 — collector must not block startup
            logger.warning("Collector not initialized: %s", exc)
    app.state.collector = collector

    async def _backfill_geocodes() -> None:
        await asyncio.sleep(STARTUP_DB_SETTLE_SECONDS)
        try:
            from server.analyzer.geocoding import backfill_stored_events

            updated = await backfill_stored_events(db)
            if updated:
                logger.info("Backfilled geocodes for %d analysis event(s)", updated)
        except Exception as exc:  # noqa: BLE001 — must not block startup
            logger.warning("Event geocode backfill skipped: %s", exc)

    return asyncio.create_task(_backfill_geocodes())


@asynccontextmanager
async def _lifespan_impl(
    app: FastAPI,
    *,
    injected_db: Optional[Database],
    db_path: str,
    start_collector: bool,
    start_scheduler: bool,
) -> AsyncIterator[None]:
    db = injected_db if injected_db is not None else Database(db_path)
    await db.connect()
    app.state.db = db

    broadcaster = SseBroadcaster()
    app.state.broadcaster = broadcaster

    lifecycle = SchemaLifecycle(db=db)
    app.state.schema_lifecycle = lifecycle
    app.state.action_executor = None
    app.state.analysis_engine = None
    app.state.scheduler = None
    app.state.collector = None

    fingerprint = await inspect_schema(db.conn)
    needs_upgrade = migration_pending(fingerprint.version)
    backfill_task: asyncio.Task[None] | None = None

    async def finish_runtime() -> None:
        nonlocal backfill_task
        if backfill_task is not None:
            return
        backfill_task = await _start_runtime_services(
            app,
            db,
            start_collector=start_collector,
            start_scheduler=start_scheduler,
        )

    lifecycle.bind_finish_runtime(finish_runtime)

    try:
        if needs_upgrade:
            await lifecycle.classify()
            # Crash mid-migrate leaves marker + baseline while still needs_upgrade:
            # restore to a consistent pre-upgrade file before showing the gate.
            await lifecycle.heal_half_migrated_if_needed()
            logger.warning(
                "Database schema v%s requires upgrade to v%s — runtime paused until upgrade",
                fingerprint.version,
                lifecycle.required_version,
            )
        else:
            await db.ensure_schema()
            await lifecycle.classify()
            # Catch stamp-before-validate crashes and cheap live integrity issues
            # before starting collector/scheduler.
            await lifecycle.verify_after_stamp_or_ready()
            if lifecycle.runtime_ready:
                backfill_task = await _start_runtime_services(
                    app,
                    db,
                    start_collector=start_collector,
                    start_scheduler=start_scheduler,
                )
            else:
                logger.warning(
                    "Startup data verification blocked runtime (state=%s): %s",
                    lifecycle.state,
                    lifecycle.error,
                )
    except BaseException as exc:
        # A rejected schema aborts startup before the shutdown block below can
        # run. aiosqlite's connection thread is not a daemon, so an unclosed
        # connection outlives "Application startup failed" and keeps both the
        # process and the SQLite file lock alive — which in turn blocks the
        # explicit-reset recovery path.
        if isinstance(exc, SchemaBaselineError):
            # Wipe-only prior stamps (v1–v16) hard-reject here. Say what to do
            # instead of leaving only a traceback. See docs/ARCHITECTURE.md.
            logger.error(
                "%s — schema v%s is not supported and cannot be upgraded in place. "
                "Reset the local database, then re-collect: python scripts/reset_local_databases.py --apply "
                "(database: %s)",
                exc,
                fingerprint.version,
                db_path,
            )
        if injected_db is None:
            await db.close()
        raise

    logger.info("Startup complete; service ready on port %d", SERVICE_PORT)
    try:
        yield
    finally:
        if backfill_task is not None:
            if not backfill_task.done():
                backfill_task.cancel()
            try:
                await backfill_task
            except CancelledError:
                pass
            except Exception as exc:  # noqa: BLE001 — best-effort shutdown observation
                logger.warning("Event geocode backfill skipped: %s", exc)

        scheduler = getattr(app.state, "scheduler", None)
        if start_scheduler and scheduler is not None:
            try:
                await scheduler.shutdown()
            except Exception as exc:  # noqa: BLE001 — best-effort shutdown
                logger.warning("Scheduler shutdown error: %s", exc)

        collector = getattr(app.state, "collector", None)
        if collector is not None:
            try:
                await collector.shutdown()
            except Exception as exc:  # noqa: BLE001 — best-effort shutdown
                logger.warning("Collector shutdown error: %s", exc)

        analysis_engine = getattr(app.state, "analysis_engine", None)
        if analysis_engine is not None:
            try:
                await analysis_engine.close()
            except Exception as exc:  # noqa: BLE001 — best-effort shutdown
                logger.warning("Analysis engine close error: %s", exc)

        action_executor = getattr(app.state, "action_executor", None)
        if action_executor is not None:
            try:
                await action_executor.shutdown()
            except Exception as exc:  # noqa: BLE001 — best-effort shutdown
                logger.warning("Action executor shutdown error: %s", exc)

        if injected_db is None:
            await db.close()


def create_app(
    *,
    db: Optional[Database] = None,
    db_path: Optional[str] = None,
    start_collector: bool = True,
    start_scheduler: bool = True,
    serve_static: bool = True,
) -> FastAPI:
    """Create the FastAPI app with every router, CORS, SSE and static files."""
    resolved_path = _resolve_db_path(db_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with _lifespan_impl(
            app,
            injected_db=db,
            db_path=resolved_path,
            start_collector=start_collector,
            start_scheduler=start_scheduler,
        ):
            yield

    app = FastAPI(title="Intelligence Monitor", version=__version__, lifespan=lifespan)

    from server.errors import register_error_handlers

    register_error_handlers(app)

    app.add_middleware(RuntimeReadyMiddleware)
    app.add_middleware(RequestBodyLimitMiddleware, max_body_size=MAX_REQUEST_BODY_BYTES)
    app.add_middleware(RateLimitMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:1420",
            "http://127.0.0.1:1420",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for router in all_routers():
        app.include_router(router)

    if serve_static:
        mount_static_files(app)

    return app


app = create_app()
