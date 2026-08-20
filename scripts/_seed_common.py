"""Shared scaffolding for the dev-only ``scripts/seed_*.py`` fixtures.

Owns the repeated cleanup / workset / linked-calendar create helpers plus the
CLI + database boilerplate. Import this module **before** any ``server.*``
import so the repo root lands on ``sys.path``.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping, Sequence
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.calendar.user_events_write import create_user_event
from server.db.database import Database, TransactionDb
from server.domain.agent_task_spec import agent_preset_spec, agent_spec_to_db_kwargs
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


def seed_content_hash(value: str) -> str:
    """Short sha256 prefix used as analysis_events content/semantic hashes."""
    return hashlib.sha256(value.encode()).hexdigest()[:24]


async def ensure_llm_profile(
    db: Database,
    *,
    profile_id: str,
    name: str,
    model: str,
    provider: str | None = None,
    base_url: str = "http://localhost:11434",
) -> None:
    """Insert a dummy profile if missing. Tasks require ``llm_profile_id``."""
    row = await db.fetch_one("SELECT id FROM llm_profiles WHERE id = ?", (profile_id,))
    if row:
        return
    now = utc_now_iso()
    if provider is None:
        await db.execute(
            "INSERT INTO llm_profiles (id, name, base_url, model, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (profile_id, name, base_url, model, now, now),
        )
        return
    await db.execute(
        "INSERT INTO llm_profiles (id, name, provider, base_url, model, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (profile_id, name, provider, base_url, model, now, now),
    )


async def ensure_intel_task(
    db: Database,
    *,
    task_id: str,
    name: str,
    llm_profile_id: str,
    analysis_mode: str,
    description: str | None = None,
    is_active: int = 1,
) -> None:
    """Idempotent intel_event (or similar) analysis_tasks insert."""
    existing = await db.fetch_one("SELECT id FROM analysis_tasks WHERE id = ?", (task_id,))
    if existing:
        return
    now = utc_now_iso()
    if description is None:
        await db.execute(
            "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
            "analysis_time_range, version, is_active, include_in_timeline, "
            "schedule_rrule, workset_id, llm_profile_id, created_at, updated_at) "
            "VALUES (?, ?, 'seed', ?, 'all', 1, ?, 1, NULL, '__general__', ?, ?, ?)",
            (task_id, name, analysis_mode, is_active, llm_profile_id, now, now),
        )
        return
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, include_in_timeline, "
        "schedule_rrule, workset_id, llm_profile_id, created_at, updated_at) "
        "VALUES (?, ?, ?, 'seed', ?, 'all', 1, ?, 1, NULL, '__general__', ?, ?, ?)",
        (task_id, name, description, analysis_mode, is_active, llm_profile_id, now, now),
    )


async def ensure_agent_task(
    db: Database,
    *,
    task_id: str,
    name: str,
    llm_profile_id: str,
    analysis_mode: str,
    preset: str,
    has_channels: bool,
    description: str | None = None,
    is_active: int = 1,
) -> None:
    """Idempotent agent-mode analysis_tasks insert from a preset policy."""
    existing = await db.fetch_one("SELECT id FROM analysis_tasks WHERE id = ?", (task_id,))
    if existing:
        return
    now = utc_now_iso()
    policy = agent_spec_to_db_kwargs(agent_preset_spec(preset, has_channels=has_channels))
    caps = (
        policy["trigger_mode"],
        int(policy["cap_calendar_read"]),
        int(policy["cap_calendar_writes"]),
        int(policy["cap_web_search"]),
        int(policy["cap_force_web_search"]),
        int(policy["cap_read_analysis_events"]),
        int(policy["cap_read_items"]),
        int(policy["output_calendar"]),
        int(policy["output_analysis_events"]),
    )
    if description is None:
        await db.execute(
            "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
            "analysis_time_range, version, is_active, include_in_timeline, "
            "schedule_rrule, workset_id, "
            "trigger_mode, cap_calendar_read, cap_calendar_writes, cap_web_search, "
            "cap_force_web_search, cap_read_analysis_events, cap_read_items, "
            "output_calendar, output_analysis_events, "
            "llm_profile_id, created_at, updated_at) "
            "VALUES (?, ?, 'seed', ?, 'all', 1, ?, 1, NULL, '__general__', "
            "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (task_id, name, analysis_mode, is_active, *caps, llm_profile_id, now, now),
        )
        return
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, description, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, include_in_timeline, "
        "schedule_rrule, workset_id, "
        "trigger_mode, cap_calendar_read, cap_calendar_writes, cap_web_search, "
        "cap_force_web_search, cap_read_analysis_events, cap_read_items, "
        "output_calendar, output_analysis_events, "
        "llm_profile_id, created_at, updated_at) "
        "VALUES (?, ?, ?, 'seed', ?, 'all', 1, ?, 1, NULL, '__general__', "
        "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (task_id, name, description, analysis_mode, is_active, *caps, llm_profile_id, now, now),
    )


async def ensure_completed_batch(
    db: Database,
    *,
    batch_id: str,
    task_id: str,
    message_count: int = 3,
    created_at: str | None = None,
    updated_at: str | None = None,
    completed_at: str | None = None,
    agent_message: str = "",
) -> None:
    """Idempotent completed analysis_batches insert."""
    existing = await db.fetch_one("SELECT id FROM analysis_batches WHERE id = ?", (batch_id,))
    if existing:
        return
    now = utc_now_iso()
    created = created_at or now
    updated = updated_at or created
    completed = completed_at or updated
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, "
        "message_count, retry_count, error_message, agent_message, created_at, "
        "updated_at, completed_at) VALUES (?, ?, 1, 'completed', ?, 0, '', ?, ?, ?, ?)",
        (batch_id, task_id, message_count, agent_message, created, updated, completed),
    )


async def insert_analysis_event(
    db: Database,
    *,
    event_id: str,
    task_id: str,
    batch_id: str,
    title: str,
    body: str,
    start: str | None,
    end: str | None,
    location: str = "",
    lat: float | None = None,
    lon: float | None = None,
    source_message_id: str | None = None,
    channel_names: Sequence[str] | None = None,
) -> None:
    """Insert one analysis_events row (content/semantic hashes derived from id)."""
    now = utc_now_iso()
    names = list(channel_names) if channel_names is not None else []
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "start_time, end_time, location, latitude, longitude, participants_json, "
        "source_message_id, batch_source_channel_names, content_hash, semantic_hash, "
        "event_key, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            task_id,
            batch_id,
            title,
            body,
            start,
            end,
            location,
            lat,
            lon,
            source_message_id,
            json.dumps(names),
            seed_content_hash(event_id + "c"),
            seed_content_hash(event_id + "s"),
            event_id,
            now,
            now,
        ),
    )


async def create_user_events_from_specs(
    db: Database,
    specs: Sequence[Mapping[str, Any]],
) -> list[str]:
    """Create standalone user_events from seed spec dicts; return ids in order."""
    created_ids: list[str] = []
    for spec in specs:
        kwargs: dict[str, Any] = {
            "title": spec["title"],
            "start_time": spec["start_time"],
            "end_time": spec.get("end_time"),
            "body": spec.get("body", ""),
            "location": spec.get("location", ""),
            "origin": spec.get("origin", "manual"),
            "is_all_day": bool(spec.get("is_all_day", False)),
        }
        if "workset_id" in spec:
            kwargs["workset_id"] = spec["workset_id"]
        if "task_id" in spec:
            kwargs["task_id"] = spec["task_id"]
        if "remind_before_days" in spec:
            kwargs["remind_before_days"] = spec["remind_before_days"]
        item = await create_user_event(db, **kwargs)
        created_ids.append(str(item["id"]))
    return created_ids


_ITEM_PRIMARY_EXPIRES_JOIN = """
LEFT JOIN user_events pe ON pe.id = (
  SELECT ue.id
  FROM user_events ue
  LEFT JOIN timeline_dismissals td
    ON td.source = 'user' AND td.event_id = ue.id
  WHERE ue.item_id = i.id
    AND ue.kind = 'expires'
    AND td.event_id IS NULL
  ORDER BY ue.created_at ASC, ue.id ASC
  LIMIT 1
)
"""

_ITEM_PRIMARY_EXPIRES_COLUMNS = """
              i.id,
              i.title,
              CASE
                WHEN pe.start_time IS NULL THEN NULL
                ELSE substr(pe.start_time, 1, 10)
              END AS expires_at,
              pe.remind_before_days AS remind_before_days
"""


async def fetch_item_primary_expires(db: Database, item_id: str) -> dict[str, Any] | None:
    """Derive-on-read primary expires row for one item (earliest undismissed expires)."""
    return await db.fetch_one(
        f"""
            SELECT
{_ITEM_PRIMARY_EXPIRES_COLUMNS}
            FROM items i
            {_ITEM_PRIMARY_EXPIRES_JOIN}
            WHERE i.id = ?
            """,
        (item_id,),
    )


async def fetch_items_primary_expires_like(db: Database, title_prefix: str) -> list[dict[str, Any]]:
    """Derive-on-read primary expires for items whose title matches ``prefix%``."""
    return await db.fetch_all(
        f"""
        SELECT
{_ITEM_PRIMARY_EXPIRES_COLUMNS}
        FROM items i
        {_ITEM_PRIMARY_EXPIRES_JOIN}
        WHERE i.title LIKE ?
        ORDER BY i.title
        """,
        (f"{title_prefix}%",),
    )


async def _run_seed_session(
    *,
    args: argparse.Namespace,
    path: Path,
    run: Callable[[Database, argparse.Namespace, Path], Awaitable[None]],
) -> None:
    async with open_seed_db(path) as db:
        await run(db, args, path)


def run_seed_cli(
    *,
    description: str | None,
    prefix: str,
    run: Callable[[Database, argparse.Namespace, Path], Awaitable[None]],
    extra_parser: Callable[[argparse.ArgumentParser], None] | None = None,
    utf8: bool = False,
    warn_missing_db: bool = False,
    before_open: Callable[[argparse.Namespace, Path], None] | None = None,
    on_error: Callable[[BaseException], bool] | None = None,
) -> None:
    """Shared CLI entry: parse ``--clean``/``--db``, open the DB, then ``run``.

    ``on_error`` may handle the exception (return True) or re-raise (return False).
    """
    if utf8:
        utf8_stdio()
    parser = build_seed_parser(description, prefix=prefix)
    if extra_parser:
        extra_parser(parser)
    args = parser.parse_args()
    path = resolve_db_path(args.db)
    print(f"DB: {path}")
    if warn_missing_db and not path.is_file():
        print("Warning: database file does not exist yet; schema will be bootstrapped.")
    if before_open:
        before_open(args, path)
    try:
        asyncio.run(_run_seed_session(args=args, path=path, run=run))
    except Exception as exc:
        if on_error and on_error(exc):
            return
        raise
