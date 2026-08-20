"""Seed traceability / correction UI fixtures (NOT the pipeline checklist).

Prefix: ``[demo]`` on titles so they are easy to spot and delete later.
Writes the live app SQLite (Windows: ``%APPDATA%\\Intelligence Monitor\\intelligence_monitor.db``).
Requires wipe-only stamp 1 (``SCHEMA_SEMVER`` ``1.0.0``); reset first if needed.

Covers:
  - Intelligence detail: analysis_events with and without ``source_message_id``
  - 「不是情報」/「從時間軸拿掉」: dated August 2026 intel events
  - Agent page 「收回最近一次調和」: completed agent batch + origin=agent user_events

  uv run python scripts/seed_trace_correct_demo.py
  uv run python scripts/seed_trace_correct_demo.py --clean   # remove [demo] rows only
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import sqlite3
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from _seed_common import (
    build_seed_parser,
    builtin_category_id,
    clean_calendar_fixtures,
    create_linked_milestone,
    open_seed_db,
    resolve_db_path,
    utf8_stdio,
)

from server.calendar.user_events_write import create_user_event
from server.db.database import Database, SchemaBaselineError
from server.db.schema_inspect import CURRENT_SCHEMA_VERSION, SCHEMA_SEMVER
from server.db.sqlite_busy import is_sqlite_busy
from server.domain.agent_task_spec import agent_preset_spec, agent_spec_to_db_kwargs
from server.domain.analysis_modes import AGENT_MODE, INTEL_EVENT_MODE
from server.domain.user_event_kinds import USER_EVENT_KIND_EXPIRES
from server.items.service import create_item
from server.services.recurring_series_create import create_recurring_series
from server.util import utc_now_iso

PREFIX = "[demo]"
IDP = "demo-trace"

SOURCE_ID = f"{IDP}-rss"
RSS_FEED_URL = "https://demo.local/intelligence-monitor/trace-correct.xml"
LLM_PROFILE_ID = f"{IDP}-llm"
INTEL_TASK_ID = f"{IDP}-intel"
AGENT_TASK_ID = f"{IDP}-agent"
INTEL_BATCH_ID = f"{IDP}-intel-batch"
AGENT_BATCH_ID = f"{IDP}-agent-batch"

MSG_BOUND_1 = f"{IDP}-msg-1"
MSG_BOUND_2 = f"{IDP}-msg-2"
MSG_UNBOUND_CONTEXT = f"{IDP}-msg-3"

AE_BOUND_1 = f"{IDP}-ae-bound-1"
AE_BOUND_2 = f"{IDP}-ae-bound-2"
AE_UNBOUND_DATED = f"{IDP}-ae-unbound-1"
AE_UNBOUND_UNTIMED = f"{IDP}-ae-unbound-2"

RESET_CMD = "uv run python scripts/reset_local_databases.py --apply"
SEED_CMD = "uv run python scripts/seed_trace_correct_demo.py"


def _hash(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()[:24]


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _peek_stamp(path: Path) -> int | None:
    """Read ``PRAGMA user_version`` without bootstrapping. None if the file is missing."""
    if not path.is_file():
        return None
    con = sqlite3.connect(str(path), timeout=8.0)
    try:
        row = con.execute("PRAGMA user_version").fetchone()
        return int(row[0]) if row else 0
    finally:
        con.close()


def _stamp_mismatch_exit(stamp_val: object) -> None:
    print(
        f"ERROR: schema stamp={stamp_val!r} (need {CURRENT_SCHEMA_VERSION} / "
        f"SCHEMA_SEMVER {SCHEMA_SEMVER}). Run:\n  {RESET_CMD}\nthen re-run:\n  {SEED_CMD}",
        file=sys.stderr,
    )


async def _clean(db: Database) -> None:
    """Remove only this script's demo namespace (not unrelated user data)."""
    like_id = f"{IDP}-%"
    like_title = f"{PREFIX}%"
    task_ids = (INTEL_TASK_ID, AGENT_TASK_ID)

    for table in ("timeline_importance", "timeline_dismissals"):
        await db.execute(f"DELETE FROM {table} WHERE event_id LIKE ?", (like_id,))
        await db.execute(
            f"DELETE FROM {table} WHERE event_id IN (SELECT id FROM analysis_events WHERE id LIKE ?)",
            (like_id,),
        )
        await db.execute(
            f"DELETE FROM {table} WHERE event_id IN (SELECT id FROM user_events WHERE title LIKE ?)",
            (like_title,),
        )

    await db.execute("DELETE FROM analysis_markers WHERE task_id IN (?, ?)", task_ids)
    await db.execute("DELETE FROM analysis_events WHERE id LIKE ?", (like_id,))
    await db.execute("DELETE FROM analysis_events WHERE title LIKE ?", (like_title,))
    await db.execute("DELETE FROM analysis_batches WHERE id IN (?, ?)", (INTEL_BATCH_ID, AGENT_BATCH_ID))
    await db.execute("DELETE FROM analysis_batches WHERE task_id IN (?, ?)", task_ids)
    await db.execute("DELETE FROM task_channels WHERE task_id IN (?, ?)", task_ids)
    await db.execute("DELETE FROM recurring_schedules WHERE parent_task_id = ?", (AGENT_TASK_ID,))
    await db.execute("DELETE FROM recurring_schedules WHERE name LIKE ?", (like_title,))
    await clean_calendar_fixtures(db, title_prefix=PREFIX, event_id_prefix=f"{IDP}-")
    for tid in task_ids:
        await db.execute("DELETE FROM analysis_tasks WHERE id = ?", (tid,))
    await db.execute("DELETE FROM llm_profiles WHERE id = ?", (LLM_PROFILE_ID,))
    await db.execute("DELETE FROM messages WHERE id LIKE ?", (like_id,))
    await db.execute("DELETE FROM source_channels WHERE source_id = ?", (SOURCE_ID,))
    await db.execute("DELETE FROM sources WHERE id = ?", (SOURCE_ID,))
    await db.execute(
        "DELETE FROM channels WHERE platform = 'rss' AND platform_id = ?",
        (RSS_FEED_URL,),
    )


async def _ensure_llm_profile(db: Database) -> None:
    """Tasks require llm_profile_id; fresh DBs seed zero profiles."""
    row = await db.fetch_one("SELECT id FROM llm_profiles WHERE id = ?", (LLM_PROFILE_ID,))
    if row:
        return
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO llm_profiles (id, name, provider, base_url, model, created_at, updated_at) "
        "VALUES (?, ?, 'ollama', 'http://localhost:11434', 'demo-trace-unused', ?, ?)",
        (LLM_PROFILE_ID, f"{PREFIX} seed profile (unused)", now, now),
    )


async def _ensure_source_and_messages(db: Database) -> None:
    now = utc_now_iso()
    source = await db.fetch_one("SELECT id FROM sources WHERE id = ?", (SOURCE_ID,))
    if not source:
        creds = json.dumps({"feed_url": RSS_FEED_URL, "poll_interval_seconds": 3600})
        await db.execute(
            "INSERT INTO sources (id, platform, name, status, credentials, "
            "last_connected_at, created_at, updated_at) VALUES (?, 'rss', ?, 'disconnected', ?, NULL, ?, ?)",
            (SOURCE_ID, f"{PREFIX} RSS 示範來源", creds, now, now),
        )
    channel = await db.fetch_one(
        "SELECT platform FROM channels WHERE platform = 'rss' AND platform_id = ?",
        (RSS_FEED_URL,),
    )
    if not channel:
        await db.execute(
            "INSERT INTO channels (platform, platform_id, channel_name, created_at) VALUES ('rss', ?, ?, ?)",
            (RSS_FEED_URL, f"{PREFIX} 示範頻道", now),
        )
    link = await db.fetch_one(
        "SELECT source_id FROM source_channels WHERE source_id = ? AND platform = 'rss' AND platform_id = ?",
        (SOURCE_ID, RSS_FEED_URL),
    )
    if not link:
        await db.execute(
            "INSERT INTO source_channels (source_id, platform, platform_id) VALUES (?, 'rss', ?)",
            (SOURCE_ID, RSS_FEED_URL),
        )

    messages = [
        (
            MSG_BOUND_1,
            "demo-pmid-1",
            "示範記者",
            "【路演】明日下午兩點在會展中心舉行產品路演，開放媒體入場。",
            "2026-08-17T04:00:00Z",
        ),
        (
            MSG_BOUND_2,
            "demo-pmid-2",
            "票務通知",
            "演唱會門票今日上午十點開賣，官方通路限量。",
            "2026-08-19T22:00:00Z",
        ),
        (
            MSG_UNBOUND_CONTEXT,
            "demo-pmid-3",
            "論壇閒聊",
            "有人聽說週末可能有臨時論壇，但沒有正式公告。",
            "2026-08-18T08:00:00Z",
        ),
    ]
    for message_id, pmid, sender, content, timestamp in messages:
        exists = await db.fetch_one("SELECT id FROM messages WHERE id = ?", (message_id,))
        if exists:
            continue
        await db.execute(
            "INSERT INTO messages (id, source_id, platform, platform_id, "
            "platform_message_id, sender_id, sender_name, content, timestamp, "
            "raw_data, created_at) VALUES (?, ?, 'rss', ?, ?, 'demo-sender', ?, ?, ?, NULL, ?)",
            (message_id, SOURCE_ID, RSS_FEED_URL, pmid, sender, content, timestamp, now),
        )


async def _ensure_tasks(db: Database) -> None:
    now = utc_now_iso()
    intel = await db.fetch_one("SELECT id FROM analysis_tasks WHERE id = ?", (INTEL_TASK_ID,))
    if not intel:
        await db.execute(
            "INSERT INTO analysis_tasks (id, name, description, prompt_template, analysis_mode, "
            "analysis_time_range, version, is_active, include_in_timeline, "
            "schedule_rrule, workset_id, llm_profile_id, created_at, updated_at) "
            "VALUES (?, ?, ?, 'seed', ?, 'all', 1, 0, 1, NULL, '__general__', ?, ?, ?)",
            (
                INTEL_TASK_ID,
                f"{PREFIX} 情報事件任務",
                "dev seed — inactive so dummy LLM is never ticked",
                INTEL_EVENT_MODE,
                LLM_PROFILE_ID,
                now,
                now,
            ),
        )

    agent = await db.fetch_one("SELECT id FROM analysis_tasks WHERE id = ?", (AGENT_TASK_ID,))
    if not agent:
        policy = agent_spec_to_db_kwargs(agent_preset_spec("project_reconcile", has_channels=True))
        await db.execute(
            "INSERT INTO analysis_tasks (id, name, description, prompt_template, analysis_mode, "
            "analysis_time_range, version, is_active, include_in_timeline, "
            "schedule_rrule, workset_id, "
            "trigger_mode, cap_calendar_read, cap_calendar_writes, cap_web_search, "
            "cap_force_web_search, cap_read_analysis_events, cap_read_items, "
            "output_calendar, output_analysis_events, "
            "llm_profile_id, created_at, updated_at) "
            "VALUES (?, ?, ?, 'seed', ?, 'all', 1, 0, 1, NULL, '__general__', "
            "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                AGENT_TASK_ID,
                f"{PREFIX} Agent 調和任務",
                "dev seed — inactive; completed batch is pre-inserted",
                AGENT_MODE,
                policy["trigger_mode"],
                int(policy["cap_calendar_read"]),
                int(policy["cap_calendar_writes"]),
                int(policy["cap_web_search"]),
                int(policy["cap_force_web_search"]),
                int(policy["cap_read_analysis_events"]),
                int(policy["cap_read_items"]),
                int(policy["output_calendar"]),
                int(policy["output_analysis_events"]),
                LLM_PROFILE_ID,
                now,
                now,
            ),
        )

    for task_id in (INTEL_TASK_ID, AGENT_TASK_ID):
        bound = await db.fetch_one(
            "SELECT task_id FROM task_channels WHERE task_id = ? AND platform = 'rss' AND platform_id = ?",
            (task_id, RSS_FEED_URL),
        )
        if not bound:
            await db.execute(
                "INSERT INTO task_channels (task_id, platform, platform_id) VALUES (?, 'rss', ?)",
                (task_id, RSS_FEED_URL),
            )


async def _insert_analysis_event(
    db: Database,
    *,
    event_id: str,
    title: str,
    body: str,
    start: str | None,
    end: str | None,
    source_message_id: str | None,
    location: str = "",
) -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "start_time, end_time, location, latitude, longitude, participants_json, "
        "source_message_id, batch_source_channel_names, content_hash, semantic_hash, "
        "event_key, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, NULL, '[]', ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            INTEL_TASK_ID,
            INTEL_BATCH_ID,
            title,
            body,
            start,
            end,
            location,
            source_message_id,
            json.dumps([f"{PREFIX} 示範頻道"]),
            _hash(event_id + "c"),
            _hash(event_id + "s"),
            event_id,
            now,
            now,
        ),
    )


async def seed(db: Database) -> dict[str, object]:
    await _clean(db)
    await _ensure_llm_profile(db)
    await _ensure_source_and_messages(db)
    await _ensure_tasks(db)

    now_dt = datetime.now(UTC)
    intel_now = _iso(now_dt)
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, "
        "message_count, retry_count, error_message, agent_message, created_at, "
        "updated_at, completed_at) VALUES (?, ?, 1, 'completed', 3, 0, '', '', ?, ?, ?)",
        (INTEL_BATCH_ID, INTEL_TASK_ID, intel_now, intel_now, intel_now),
    )

    analysis_specs = [
        {
            "id": AE_BOUND_1,
            "title": f"{PREFIX} 情報：論壇路演（已綁來源）",
            "body": "點進詳情應見到可摺疊來源引言，並可在 Monitor 打開原訊。",
            "start": "2026-08-18T14:00:00+08:00",
            "end": "2026-08-18T16:00:00+08:00",
            "source_message_id": MSG_BOUND_1,
            "location": "會展中心",
        },
        {
            "id": AE_BOUND_2,
            "title": f"{PREFIX} 情報：門票開賣（已綁來源）",
            "body": "第二則已綁來源，方便對照「不是情報」與時間軸拿掉。",
            "start": "2026-08-20T10:00:00+08:00",
            "end": "2026-08-20T11:00:00+08:00",
            "source_message_id": MSG_BOUND_2,
            "location": "官方通路",
        },
        {
            "id": AE_UNBOUND_DATED,
            "title": f"{PREFIX} 情報：模型沒有綁定來源",
            "body": "source_message_id 為空；詳情應明示模型沒有綁定來源訊息。",
            "start": "2026-08-19T09:00:00+08:00",
            "end": "2026-08-19T10:00:00+08:00",
            "source_message_id": None,
            "location": "未標地點",
        },
        {
            "id": AE_UNBOUND_UNTIMED,
            "title": f"{PREFIX} 情報：無時間且未綁來源",
            "body": "出現在情報列表，不進八月日曆格。",
            "start": None,
            "end": None,
            "source_message_id": None,
            "location": "N/A",
        },
    ]
    for spec in analysis_specs:
        await _insert_analysis_event(
            db,
            event_id=spec["id"],
            title=spec["title"],
            body=spec["body"],
            start=spec["start"],
            end=spec["end"],
            source_message_id=spec["source_message_id"],
            location=spec.get("location") or "",
        )

    wave_start = now_dt - timedelta(minutes=10)
    wave_mid = now_dt - timedelta(minutes=4)
    wave_end = now_dt + timedelta(minutes=2)
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, "
        "message_count, retry_count, error_message, agent_message, created_at, "
        "updated_at, completed_at) VALUES (?, ?, 1, 'completed', 3, 0, '', "
        "'[demo] 已寫入調和日程', ?, ?, ?)",
        (AGENT_BATCH_ID, AGENT_TASK_ID, _iso(wave_start), _iso(wave_end), _iso(wave_end)),
    )

    agent_event_specs = [
        {
            "title": f"{PREFIX} 調和寫入：週會對帳",
            "start_time": "2026-08-21T09:30:00+08:00",
            "end_time": "2026-08-21T10:00:00+08:00",
            "body": "最近一次調和寫入的單次日程",
            "location": "線上",
        },
        {
            "title": f"{PREFIX} 調和寫入：出差補登",
            "start_time": "2026-08-22T09:00:00+08:00",
            "end_time": "2026-08-22T18:00:00+08:00",
            "body": "origin=agent，落在已完成批次時間窗內",
            "location": "台北",
        },
        {
            "title": f"{PREFIX} 調和寫入：截止提醒",
            "start_time": "2026-08-25T17:00:00+08:00",
            "end_time": "2026-08-25T17:30:00+08:00",
            "body": "第三則調和寫入，供收回最近一次調和使用",
            "location": "",
        },
    ]
    agent_event_ids: list[str] = []
    for spec in agent_event_specs:
        row = await create_user_event(
            db,
            title=spec["title"],
            start_time=spec["start_time"],
            end_time=spec["end_time"],
            body=spec["body"],
            location=spec["location"],
            origin="agent",
            task_id=AGENT_TASK_ID,
        )
        agent_event_ids.append(str(row["id"]))

    series = await create_recurring_series(
        db,
        name=f"{PREFIX} 調和寫入：每週站會（子循環）",
        rrule="FREQ=WEEKLY;BYDAY=TU",
        event_start_time="11:00",
        event_end_time="11:30",
        parent_task_id=AGENT_TASK_ID,
        event_description="最近一次調和建立的子循環",
        description="demo trace/correct seed",
    )
    series_id = str(series["id"])

    mid = _iso(wave_mid)
    for event_id in agent_event_ids:
        await db.execute(
            "UPDATE user_events SET created_at = ?, updated_at = ? WHERE id = ?",
            (mid, mid, event_id),
        )
    await db.execute(
        "UPDATE recurring_schedules SET created_at = ?, updated_at = ? WHERE id = ?",
        (mid, mid, series_id),
    )

    cat_passport = await builtin_category_id(db, "passport_docs")
    cat_food = await builtin_category_id(db, "food")
    item_specs = [
        {
            "title": f"{PREFIX} 護照（到期日曆）",
            "category_id": cat_passport,
            "emoji": "🛂",
            "notes": "關聯「到期」日曆，方便在時間軸看物品事件",
            "expires_at": "2026-12-01",
            "remind_before_days": 30,
        },
        {
            "title": f"{PREFIX} 牛奶（即將過期）",
            "category_id": cat_food,
            "emoji": "🥛",
            "notes": "八月到期，時間軸月檢視可見提醒／到期",
            "expires_at": "2026-08-25",
            "remind_before_days": 3,
        },
    ]
    item_ids: list[str] = []
    for spec in item_specs:
        row = await create_item(
            db,
            title=spec["title"],
            category_id=spec["category_id"],
            emoji=spec["emoji"],
            notes=spec["notes"],
        )
        item_id = str(row["id"])
        item_ids.append(item_id)
        await create_linked_milestone(
            db,
            item_id=item_id,
            title="到期",
            day=spec["expires_at"],
            kind=USER_EVENT_KIND_EXPIRES,
            remind_before_days=spec["remind_before_days"],
        )

    return {
        "source_id": SOURCE_ID,
        "messages": [MSG_BOUND_1, MSG_BOUND_2, MSG_UNBOUND_CONTEXT],
        "intel_task_id": INTEL_TASK_ID,
        "agent_task_id": AGENT_TASK_ID,
        "analysis_events": [spec["id"] for spec in analysis_specs],
        "agent_user_events": agent_event_ids,
        "agent_recurring_id": series_id,
        "items": item_ids,
        "agent_batch_window": {"created_at": _iso(wave_start), "completed_at": _iso(wave_end)},
    }


def _print_howto(path: Path, seeded: dict[str, object]) -> None:
    agent_id = seeded["agent_task_id"]
    print(f"DB: {path}")
    print("Seeded:", json.dumps(seeded, ensure_ascii=False, indent=2))
    print()
    print("UI pages:")
    print("  /intelligence  — 標題 [demo]；已綁來源有摺疊引言＋開 Monitor；未綁顯示「模型沒有綁定來源訊息」")
    print("                   卡片「不是情報」會軟隱藏")
    print("  /timeline      — 2026 年 8 月月檢視／列表；情報卡「從時間軸拿掉」；物品到期／提醒")
    print("  /monitor       — 示範 RSS 訊息（也可從情報詳情「在 Monitor 打開」）")
    print(f"  /tasks/{agent_id}/agent  — 「收回最近一次調和」（origin=agent 寫入 3 則＋子循環）")
    print()
    print("Tasks are is_active=0 so the dummy LLM profile is never scheduled.")
    print(f"Cleanup later: {SEED_CMD} --clean")


async def main() -> None:
    utf8_stdio()
    args = build_seed_parser(__doc__, prefix=PREFIX).parse_args()
    path = resolve_db_path(args.db)
    print(f"DB: {path}")

    try:
        stamp = _peek_stamp(path)
    except sqlite3.OperationalError as exc:
        print(
            f"ERROR: cannot read schema stamp ({exc}). If the app has the DB locked, close it or retry:\n"
            f"  {SEED_CMD}",
            file=sys.stderr,
        )
        raise SystemExit(3) from exc

    if stamp is not None and int(stamp) != CURRENT_SCHEMA_VERSION:
        _stamp_mismatch_exit(stamp)
        raise SystemExit(2)

    try:
        async with open_seed_db(path) as db:
            stamp_row = await db.fetch_one("PRAGMA user_version")
            stamp_val = list(stamp_row.values())[0] if stamp_row else None
            print(f"Schema stamp: {stamp_val} ({SCHEMA_SEMVER})")
            if int(stamp_val or 0) != CURRENT_SCHEMA_VERSION:
                _stamp_mismatch_exit(stamp_val)
                raise SystemExit(2)

            if args.clean:
                await _clean(db)
                print(f"Cleaned prior {PREFIX} fixtures (no re-seed)")
                return

            seeded = await seed(db)
            _print_howto(path, seeded)
    except SchemaBaselineError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        _stamp_mismatch_exit("mismatch")
        raise SystemExit(2) from exc
    except Exception as exc:
        if is_sqlite_busy(exc):
            print(
                f"ERROR: database is locked (server probably running). Close the app or retry:\n  {SEED_CMD}",
                file=sys.stderr,
            )
            raise SystemExit(3) from exc
        raise


if __name__ == "__main__":
    asyncio.run(main())
