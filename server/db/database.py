"""aiosqlite connection wrapper with schema-fingerprint validation.

Schema bootstrap／reject is delegated to ``server.db.schema_bootstrap``
(wipe-only stamp-42; no migration registry). Destructive rebuild remains an
explicit reset operation (no auto-seed). See ``docs/ARCHITECTURE.md`` for the
supported schema matrix.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from typing import Any, Protocol, TypeVar

import aiosqlite

from server.db.schema import DDL
from server.db.schema_bootstrap import (
    CURRENT_SCHEMA_VERSION,
    SchemaEvolutionError,
    ensure_supported_schema,
)
from server.db.sqlite_busy import is_sqlite_busy

logger = logging.getLogger(__name__)

_SQLITE_BUSY_RETRIES = 5
_SQLITE_BUSY_DELAYS_S = (0.05, 0.1, 0.2, 0.4, 0.8)
_ResultT = TypeVar("_ResultT")


class SchemaBaselineError(RuntimeError):
    """Raised when a database schema version or fingerprint is unsupported."""


class SupportsExecute(Protocol):
    """Write-only query surface shared by ``Database`` and ``TransactionDb``.

    Write helpers that must run either standalone or inside an open
    ``transaction()`` take this instead of the concrete ``Database``.
    """

    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int: ...


async def _with_busy_retry(action: Callable[[], Awaitable[_ResultT]]) -> _ResultT:
    """Run one database operation, retrying only SQLite busy/locked failures."""
    last_exc: BaseException | None = None
    for attempt in range(_SQLITE_BUSY_RETRIES):
        try:
            return await action()
        except Exception as exc:
            last_exc = exc
            if not is_sqlite_busy(exc) or attempt >= _SQLITE_BUSY_RETRIES - 1:
                raise
        await asyncio.sleep(_SQLITE_BUSY_DELAYS_S[attempt])
    assert last_exc is not None
    raise last_exc


class Database:
    """Thin async wrapper around a single aiosqlite connection.

    Route handlers and subsystems share one connection; SQLite serializes
    writes, and long LLM calls are made without holding any transaction.
    """

    def __init__(self, path: str) -> None:
        self._path = path
        self._conn: aiosqlite.Connection | None = None
        self._lock = asyncio.Lock()
        self._transaction_owner: asyncio.Task[Any] | None = None

    @property
    def path(self) -> str:
        return self._path

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("Database.connect() must be called before use")
        return self._conn

    async def connect(self) -> None:
        """Open the connection with WAL + foreign keys enabled."""
        if self._conn is not None:
            return
        conn = await aiosqlite.connect(self._path, timeout=30.0)
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA busy_timeout=15000")
        await conn.execute("PRAGMA foreign_keys=ON")
        await conn.commit()
        self._conn = conn

    async def close(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    # ── schema ──────────────────────────────────────────────────────────

    async def ensure_schema(self) -> None:
        """Delegate all schema classification and stamping to one entry."""
        try:
            await ensure_supported_schema(self.conn)
        except SchemaEvolutionError as exc:
            raise SchemaBaselineError(str(exc)) from exc

    async def _rebuild_file(self) -> None:
        """Wipe all user data and recreate the current schema.

        Uses an in-place DROP + DDL apply under the DB lock. Closing and
        ``os.remove``-ing the file is unreliable on Windows (WinError 32 while
        WAL/handles linger) and previously left ``_conn is None`` after a failed
        delete so every subsequent request crashed with
        ``Database.connect() must be called before use``.
        """
        async with self._lock:
            if self._conn is None:
                await self.connect()
            conn = self._conn
            assert conn is not None

            await conn.execute("PRAGMA foreign_keys=OFF")
            await conn.commit()

            async with conn.execute(
                "SELECT type, name FROM sqlite_master "
                "WHERE name NOT LIKE 'sqlite_%' "
                "AND type IN ('table', 'view', 'trigger')"
            ) as cursor:
                objects = [(str(row[0]), str(row[1])) for row in await cursor.fetchall()]

            # Non-tables first (views/triggers), then tables — FK is off either way.
            objects.sort(key=lambda item: 0 if item[0] != "table" else 1)
            for typ, name in objects:
                safe = name.replace('"', '""')
                await conn.execute(f'DROP {typ.upper()} IF EXISTS "{safe}"')

            with suppress(Exception):
                await conn.execute("DELETE FROM sqlite_sequence")

            await conn.executescript(DDL)
            await conn.execute(f"PRAGMA user_version={CURRENT_SCHEMA_VERSION}")
            await conn.execute("PRAGMA foreign_keys=ON")
            await conn.commit()
            try:
                await conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                await conn.commit()
            except Exception:  # noqa: BLE001 — checkpoint is best-effort cleanup
                logger.debug("wal_checkpoint after rebuild failed", exc_info=True)

    # ── query helpers ──────────────────────────────────────────────────

    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int:
        """Execute one statement under the lock; returns the affected rowcount."""

        async def action() -> int:
            async with self._lock:
                cursor = await self.conn.execute(sql, params)
                rowcount = cursor.rowcount
                await cursor.close()
                await self.conn.commit()
            return int(rowcount or 0)

        return await _with_busy_retry(action)

    async def execute_many(self, sql: str, rows: list[tuple[Any, ...]]) -> None:
        if not rows:
            return

        async def action() -> None:
            async with self._lock:
                await self.conn.executemany(sql, rows)
                await self.conn.commit()

        await _with_busy_retry(action)

    async def fetch_all(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        async def action() -> list[dict[str, Any]]:
            async with self._lock, self.conn.execute(sql, params) as cursor:
                rows = await cursor.fetchall()
            return [dict(row) for row in rows]

        return await _with_busy_retry(action)

    async def fetch_one(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        async def action() -> dict[str, Any] | None:
            async with self._lock, self.conn.execute(sql, params) as cursor:
                row = await cursor.fetchone()
            return dict(row) if row is not None else None

        return await _with_busy_retry(action)

    async def fetch_value(self, sql: str, params: tuple[Any, ...] = ()) -> Any:
        """Return the first column of the first row (or None)."""
        row = await self.fetch_one(sql, params)
        if row is None:
            return None
        return next(iter(row.values()), None)

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[aiosqlite.Connection]:
        """Single, non-nestable transaction (BEGIN IMMEDIATE ... COMMIT/ROLLBACK)."""
        owner = asyncio.current_task()
        if owner is not None and self._transaction_owner is owner:
            raise RuntimeError("Database.transaction() cannot be nested in the same task")

        async with self._lock:
            self._transaction_owner = owner
            try:
                await _with_busy_retry(lambda: self.conn.execute("BEGIN IMMEDIATE"))

                try:
                    yield self.conn
                    await self.conn.commit()
                except BaseException:
                    try:
                        await self.conn.rollback()
                    except BaseException:
                        logger.exception("Failed to roll back database transaction")
                    raise
            finally:
                if self._transaction_owner is owner:
                    self._transaction_owner = None


class TransactionDb:
    """Adapts a raw ``transaction()`` connection to the Database query-helper
    protocol (``execute`` / ``fetch_one`` / ``fetch_value``) so shared write
    helpers (e.g. ``server.ingestion``) can run inside an open transaction.
    """

    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int:
        cursor = await self._conn.execute(sql, params)
        rowcount = cursor.rowcount
        await cursor.close()
        return int(rowcount or 0)

    async def fetch_one(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        async with self._conn.execute(sql, params) as cursor:
            row = await cursor.fetchone()
        return dict(row) if row is not None else None

    async def fetch_all(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        async with self._conn.execute(sql, params) as cursor:
            rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def fetch_value(self, sql: str, params: tuple[Any, ...] = ()) -> Any:
        row = await self.fetch_one(sql, params)
        if row is None:
            return None
        return next(iter(row.values()), None)
