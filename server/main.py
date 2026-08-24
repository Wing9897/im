"""FastAPI application factory + lifespan startup sequence.

Startup order:
    1. Database connect + create/validate/migrate the current schema.
    2. Probe stored secrets.
    3. Start orphan recovery, scheduler and collector when secrets are usable.

Unlike the previous rebuild, CORS and production static-file serving are wired
here from day one — their absence was a root cause of the packaged app
failing to load.
"""

from __future__ import annotations

import asyncio
import logging
import os
from asyncio import CancelledError
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

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
from server.http_limits import (
    MAX_REQUEST_BODY_BYTES,
    RateLimitMiddleware,
    RequestBodyLimitMiddleware,
)
from server.paths import default_db_path, ensure_data_dir
from server.runtime_ready import RuntimeReadyMiddleware
from server.secrets_probe import probe_stored_secrets
from server.sse import SseBroadcaster
from server.static_files import mount_static_files

logger = logging.getLogger(__name__)


def _resolve_db_path(db_path: str | None) -> str:
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

    collector: Any | None = None
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
    injected_db: Database | None,
    db_path: str,
    start_collector: bool,
    start_scheduler: bool,
) -> AsyncIterator[None]:
    db = injected_db if injected_db is not None else Database(db_path)
    await db.connect()
    app.state.db = db

    broadcaster = SseBroadcaster()
    app.state.broadcaster = broadcaster

    app.state.action_executor = None
    app.state.analysis_engine = None
    app.state.scheduler = None
    app.state.collector = None
    # Default ready until a probe runs; only a failed decrypt flips this False.
    app.state.secrets_ready = True
    app.state.secrets_error = None

    backfill_task: asyncio.Task[None] | None = None

    async def apply_secrets_probe() -> bool:
        ready, err = await probe_stored_secrets(db)
        app.state.secrets_ready = ready
        app.state.secrets_error = err
        if not ready:
            logger.error(
                "Stored secrets cannot be decrypted — business APIs paused until rotate-secrets (or full reset): %s",
                err,
            )
        return ready

    async def finish_runtime() -> None:
        nonlocal backfill_task
        if backfill_task is not None:
            return
        if not await apply_secrets_probe():
            return
        backfill_task = await _start_runtime_services(
            app,
            db,
            start_collector=start_collector,
            start_scheduler=start_scheduler,
        )

    app.state.ensure_runtime_started = finish_runtime

    try:
        await db.ensure_schema()
        await finish_runtime()
    except BaseException as exc:
        # A rejected schema aborts startup before the shutdown block below can
        # run. aiosqlite's connection thread is not a daemon, so an unclosed
        # connection outlives "Application startup failed" and keeps both the
        # process and the SQLite file lock alive — which in turn blocks the
        # explicit-reset recovery path.
        if isinstance(exc, SchemaBaselineError):
            logger.exception("%s (database: %s)", exc, db_path)
        if injected_db is None:
            await db.close()
        raise

    logger.info("Startup complete; service ready on port %d", SERVICE_PORT)
    mcp_session_manager = getattr(app.state, "mcp_session_manager", None)
    mcp_runner: asyncio.Task[None] | None = None
    try:
        if mcp_session_manager is not None:
            # Run the MCP session manager in its own task so anyio cancel scopes
            # enter/exit on the same task (pytest-asyncio + FastAPI nested
            # lifespans otherwise tear down across tasks).
            ready = asyncio.Event()

            async def _run_mcp_session_manager() -> None:
                try:
                    async with mcp_session_manager.run():
                        ready.set()
                        # Block until this task is cancelled on shutdown.
                        await asyncio.get_running_loop().create_future()
                except BaseException:
                    ready.set()
                    raise

            mcp_runner = asyncio.create_task(_run_mcp_session_manager())
            await ready.wait()
            if mcp_runner.done():
                await mcp_runner  # re-raise startup failure
        yield
    finally:
        if mcp_runner is not None:
            mcp_runner.cancel()
            try:
                await mcp_runner
            except CancelledError:
                pass
            except Exception as exc:  # noqa: BLE001 — best-effort shutdown
                logger.warning("MCP session manager shutdown error: %s", exc)
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
    db: Database | None = None,
    db_path: str | None = None,
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

    from server.api.openapi_ext import install_openapi_extensions

    install_openapi_extensions(app)

    from server.api.routes.mcp import attach_mcp

    attach_mcp(app)

    if serve_static:
        mount_static_files(app)

    return app


app = create_app()
