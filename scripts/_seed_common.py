"""Shared scaffolding for the dev-only ``scripts/seed_*.py`` fixtures.

Owns the repeated cleanup / workset / linked-calendar create helpers plus the
CLI + database boilerplate. Import this module **before** any ``server.*``
import so the repo root lands on ``sys.path``.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.calendar.user_events_write import create_user_event
from server.db.database import Database, TransactionDb
from server.paths import default_db_path
from server.queries.items_queries import fetch_category_by_slug
from server.queries.worksets_queries import insert_workset
from server.util import utc_now_iso


def utf8_stdio() -> None:
    """Reconfigure stdout/stderr to UTF-8 (legacy Windows console code pages)."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            with suppress(Exception):
                reconfigure(encoding="utf-8")


def build_seed_parser(description: str | None, *, prefix: str) -> argparse.ArgumentParser:
    """Argument parser with the flags every seed script shares."""
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--clean", action="store_true", help=f"Remove prior {prefix} fixtures first")
    parser.add_argument("--db", type=str, default="", help="Override SQLite path")
    return parser


def resolve_db_path(db_arg: str) -> Path:
    return Path(db_arg) if db_arg else default_db_path()


@asynccontextmanager
async def open_seed_db(path: Path) -> AsyncIterator[Database]:
    """Connect and bootstrap schema (a fresh wipe leaves an empty file)."""
    db = Database(str(path))
    await db.connect()
    try:
        await db.ensure_schema()
        yield db
    finally:
        await db.close()


async def ensure_workset(db: Database, *, ws_id: str, name: str) -> None:
    existing = await db.fetch_one("SELECT id FROM worksets WHERE id = ?", (ws_id,))
    if existing:
        return
    async with db.transaction() as conn:
        await insert_workset(TransactionDb(conn), workset_id=ws_id, name=name, now=utc_now_iso())


async def delete_workset(db: Database, ws_id: str) -> None:
    """Callers must remove workset-referencing extras (recurring, tasks) first."""
    await db.execute("DELETE FROM worksets WHERE id = ?", (ws_id,))


async def builtin_category_id(db: Database, slug: str) -> str:
    row = await fetch_category_by_slug(db, slug)
    if row is None:
        raise RuntimeError(f"built-in category slug missing: {slug}")
    return str(row["id"])


async def clean_calendar_fixtures(
    db: Database,
    *,
    title_prefix: str,
    event_id_prefix: str | None = None,
) -> None:
    """Best-effort removal of the fixture rows every seed script shares.

    Deletes timeline importance/dismissal markers, prefixed ``user_events``,
    item-linked milestones, and prefixed ``items``. Script-specific rows
    (analysis tables, categories, recurring series, tasks, worksets) stay in
    the caller.
    """
    like_title = f"{title_prefix}%"
    for table in ("timeline_importance", "timeline_dismissals"):
        if event_id_prefix:
            await db.execute(f"DELETE FROM {table} WHERE event_id LIKE ?", (f"{event_id_prefix}%",))
        await db.execute(
            f"DELETE FROM {table} WHERE event_id IN (SELECT id FROM user_events WHERE title LIKE ?)",
            (like_title,),
        )
    if event_id_prefix:
        await db.execute("DELETE FROM user_events WHERE id LIKE ?", (f"{event_id_prefix}%",))
    await db.execute("DELETE FROM user_events WHERE title LIKE ?", (like_title,))
    # Linked item milestones may not carry the title prefix (e.g.「到期」/「購入」).
    await db.execute(
        "DELETE FROM user_events WHERE item_id IN (SELECT id FROM items WHERE title LIKE ?)",
        (like_title,),
    )
    await db.execute("DELETE FROM items WHERE title LIKE ?", (like_title,))


async def create_linked_milestone(
    db: Database,
    *,
    item_id: str,
    title: str,
    day: str,
    kind: str | None = None,
    workset_id: str | None = None,
    remind_before_days: Any = None,
    amount: Any = None,
    direction: str | None = None,
    body: str = "",
) -> dict[str, Any]:
    """Create an all-day user event linked to an item (``origin=manual``)."""
    return await create_user_event(
        db,
        title=title,
        start_time=f"{day}T00:00:00Z",
        is_all_day=True,
        item_id=item_id,
        workset_id=workset_id,
        remind_before_days=remind_before_days,
        kind=kind,
        amount=amount,
        direction=direction,
        body=body,
        origin="manual",
    )
