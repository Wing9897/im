"""Seed varied calendar fixtures for Timeline / Calendar UI visual checks.

Prefix: ``[cal-ui]`` on titles so they are easy to spot and delete later.
Run against the live app DB (default data dir) while the server may be running.

  python scripts/seed_calendar_ui_fixtures.py
  python scripts/seed_calendar_ui_fixtures.py --clean   # remove prior [cal-ui] rows first
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.calendar.timeline_dismissals import dismiss_timeline_event
from server.calendar.user_events import create_user_event
from server.db.database import Database, TransactionDb
from server.items.service import create_item
from server.paths import default_db_path
from server.queries.worksets_queries import insert_workset
from server.services.recurring_task_create import create_recurring_task
from server.util import utc_now_iso

PREFIX = "[cal-ui]"
WS_ID = "ws-cal-ui-demo"
INTEL_TASK_ID = "cal-ui-intel-event"
WEB_TASK_ID = "cal-ui-web-intel"
PROJECT_TASK_ID = "cal-ui-project"
BATCH_ID = "cal-ui-intel-batch"


def _hash(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()[:24]


async def _clean(db: Database) -> None:
    """Remove previous fixture rows (best-effort by title / known ids)."""
    await db.execute("DELETE FROM timeline_dismissals WHERE event_id LIKE 'cal-ui-%'")
    await db.execute("DELETE FROM analysis_events WHERE id LIKE 'cal-ui-%'")
    await db.execute("DELETE FROM analysis_batches WHERE id = ?", (BATCH_ID,))
    await db.execute(
        "DELETE FROM user_events WHERE title LIKE ? OR id LIKE 'cal-ui-%'",
        (f"{PREFIX}%",),
    )
    await db.execute("DELETE FROM items WHERE title LIKE ?", (f"{PREFIX}%",))
    # Recurring: delete tasks by name prefix (cascades schedules)
    rows = await db.fetch_all(
        "SELECT id FROM analysis_tasks WHERE name LIKE ?",
        (f"{PREFIX}%",),
    )
    for row in rows:
        await db.execute("DELETE FROM analysis_tasks WHERE id = ?", (row["id"],))
    for tid in (INTEL_TASK_ID, WEB_TASK_ID, PROJECT_TASK_ID):
        await db.execute("DELETE FROM analysis_tasks WHERE id = ?", (tid,))
    await db.execute("DELETE FROM worksets WHERE id = ?", (WS_ID,))


async def _ensure_workset(db: Database) -> None:
    existing = await db.fetch_one("SELECT id FROM worksets WHERE id = ?", (WS_ID,))
    if existing:
        return
    async with db.transaction() as conn:
        await insert_workset(
            TransactionDb(conn),
            workset_id=WS_ID,
            name="日曆 UI 測試組",
            now=utc_now_iso(),
        )


async def _ensure_intel_tasks(db: Database) -> None:
    now = utc_now_iso()
    for task_id, name, mode in (
        (INTEL_TASK_ID, f"{PREFIX} 情報事件任務", "intel_event"),
        (WEB_TASK_ID, f"{PREFIX} 網情報任務", "web_intel"),
        (PROJECT_TASK_ID, f"{PREFIX} 專案任務", "project"),
    ):
        row = await db.fetch_one("SELECT id FROM analysis_tasks WHERE id = ?", (task_id,))
        if row:
            continue
        await db.execute(
            "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
            "analysis_time_range, version, is_active, include_in_timeline, "
            "schedule_rrule, workset_id, created_at, updated_at) "
            "VALUES (?, ?, 'seed', ?, 'all', 1, 1, 1, NULL, '__user__', ?, ?)",
            (task_id, name, mode, now, now),
        )

    batch = await db.fetch_one("SELECT id FROM analysis_batches WHERE id = ?", (BATCH_ID,))
    if not batch:
        await db.execute(
            "INSERT INTO analysis_batches (id, task_id, version, status, "
            "message_count, retry_count, error_message, agent_message, created_at, "
            "updated_at, completed_at) VALUES (?, ?, 1, 'completed', 3, 0, '', '', ?, ?, ?)",
            (BATCH_ID, INTEL_TASK_ID, now, now, now),
        )


async def _insert_analysis_event(
    db: Database,
    *,
    event_id: str,
    task_id: str,
    title: str,
    body: str,
    start: str | None,
    end: str | None,
    location: str = "",
    lat: float | None = None,
    lon: float | None = None,
) -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "start_time, end_time, location, latitude, longitude, participants_json, "
        "source_message_id, batch_source_channel_names, content_hash, semantic_hash, "
        "event_key, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, '[]', NULL, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            task_id,
            BATCH_ID,
            title,
            body,
            start,
            end,
            location,
            lat,
            lon,
            json.dumps(["cal-ui-seed"]),
            _hash(event_id + "c"),
            _hash(event_id + "s"),
            event_id,
            now,
            now,
        ),
    )


async def seed(db: Database) -> dict[str, int]:
    await _ensure_workset(db)
    await _ensure_intel_tasks(db)
    counts = {
        "user_events": 0,
        "recurring": 0,
        "items": 0,
        "analysis_events": 0,
        "dismissals": 0,
    }

    # ── user_events: timed / overnight / multi-day / all-day / origins ──
    user_specs: list[dict] = [
        # Same-day timed
        {
            "title": f"{PREFIX} 一般會議 90 分鐘",
            "start_time": "2026-08-05T10:00:00+08:00",
            "end_time": "2026-08-05T11:30:00+08:00",
            "body": "單日定時事件",
            "location": "會議室 A",
            "origin": "manual",
        },
        # Overnight (cross midnight)
        {
            "title": f"{PREFIX} 跨夜值班",
            "start_time": "2026-08-05T22:00:00+08:00",
            "end_time": "2026-08-06T06:00:00+08:00",
            "body": "跨午夜連續時段",
            "location": "值班室",
            "origin": "manual",
        },
        # Multi-day timed (3 days)
        {
            "title": f"{PREFIX} 三日出差",
            "start_time": "2026-08-07T09:00:00+08:00",
            "end_time": "2026-08-09T18:00:00+08:00",
            "body": "跨日定時（出差）",
            "location": "台北／高雄",
            "origin": "manual",
        },
        # All-day single
        {
            "title": f"{PREFIX} 全日休假",
            "start_time": "2026-08-10T00:00:00+08:00",
            "end_time": "2026-08-11T00:00:00+08:00",
            "body": "單日全天",
            "location": "",
            "origin": "manual",
            "is_all_day": True,
        },
        # All-day multi-day
        {
            "title": f"{PREFIX} 三日全天營",
            "start_time": "2026-08-12T00:00:00+08:00",
            "end_time": "2026-08-15T00:00:00+08:00",
            "body": "跨日全天",
            "location": "戶外",
            "origin": "manual",
            "is_all_day": True,
        },
        # Point-in-time (no end)
        {
            "title": f"{PREFIX} 僅開始時間提醒",
            "start_time": "2026-08-06T15:00:00+08:00",
            "end_time": None,
            "body": "無 endTime",
            "location": "",
            "origin": "manual",
        },
        # Dense overlaps on one day (stacking UI)
        {
            "title": f"{PREFIX} 重疊 A 10–12",
            "start_time": "2026-08-06T10:00:00+08:00",
            "end_time": "2026-08-06T12:00:00+08:00",
            "body": "重疊堆疊測試",
            "origin": "manual",
        },
        {
            "title": f"{PREFIX} 重疊 B 11–13",
            "start_time": "2026-08-06T11:00:00+08:00",
            "end_time": "2026-08-06T13:00:00+08:00",
            "body": "重疊堆疊測試",
            "origin": "manual",
        },
        {
            "title": f"{PREFIX} 重疊 C 11:30–12:30",
            "start_time": "2026-08-06T11:30:00+08:00",
            "end_time": "2026-08-06T12:30:00+08:00",
            "body": "三重重疊",
            "origin": "manual",
        },
        # Long title / body
        {
            "title": f"{PREFIX} 超長標題測試：" + ("很長" * 20),
            "start_time": "2026-08-08T14:00:00+08:00",
            "end_time": "2026-08-08T15:00:00+08:00",
            "body": "長正文 " + ("細節。" * 40),
            "location": "某某某某某某某某某某某某某某某某某某街道 99 號 B1",
            "origin": "manual",
        },
        # Origins
        {
            "title": f"{PREFIX} 助手建立",
            "start_time": "2026-08-05T16:00:00+08:00",
            "end_time": "2026-08-05T16:45:00+08:00",
            "origin": "assistant",
            "body": "origin=assistant",
        },
        {
            "title": f"{PREFIX} A2A 建立",
            "start_time": "2026-08-05T17:00:00+08:00",
            "end_time": "2026-08-05T17:30:00+08:00",
            "origin": "a2a",
            "body": "origin=a2a",
        },
        {
            "title": f"{PREFIX} ICS 匯入樣式",
            "start_time": "2026-08-11T09:00:00+08:00",
            "end_time": "2026-08-11T10:00:00+08:00",
            "origin": "ics",
            "body": "origin=ics",
            "location": "Imported Hall",
        },
        {
            "title": f"{PREFIX} 專案產出事件",
            "start_time": "2026-08-06T09:00:00+08:00",
            "end_time": "2026-08-06T09:45:00+08:00",
            "origin": "project",
            "task_id": PROJECT_TASK_ID,
            "body": "origin=project + task provenance",
        },
        # Other workset
        {
            "title": f"{PREFIX} 測試組工作集事件",
            "start_time": "2026-08-07T13:00:00+08:00",
            "end_time": "2026-08-07T14:00:00+08:00",
            "workset_id": WS_ID,
            "body": "workset 篩選用",
            "location": "測試組",
            "origin": "manual",
        },
        # Near month boundary
        {
            "title": f"{PREFIX} 月末跨月",
            "start_time": "2026-08-31T20:00:00+08:00",
            "end_time": "2026-09-01T02:00:00+08:00",
            "body": "跨月 overnight",
            "origin": "manual",
        },
    ]

    created_user_ids: list[str] = []
    for spec in user_specs:
        kwargs: dict = {
            "title": spec["title"],
            "start_time": spec["start_time"],
            "end_time": spec.get("end_time"),
            "body": spec.get("body", ""),
            "location": spec.get("location", ""),
            "origin": spec.get("origin", "manual"),
            "is_all_day": bool(spec.get("is_all_day", False)),
            "task_id": spec.get("task_id"),
        }
        if "workset_id" in spec:
            kwargs["workset_id"] = spec["workset_id"]
        item = await create_user_event(db, **kwargs)
        created_user_ids.append(str(item["id"]))
        counts["user_events"] += 1

    # Soft-dismiss one user event (restore UI)
    if created_user_ids:
        await dismiss_timeline_event(db, source="user", event_id=created_user_ids[0])
        counts["dismissals"] += 1

    # ── recurring tasks ──
    recurring_specs = [
        {
            "name": f"{PREFIX} 每週一站會",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "event_start_time": "09:30",
            "event_end_time": "10:00",
            "event_location": "線上",
            "event_description": "週循環定時",
        },
        {
            "name": f"{PREFIX} 每週三全天例行",
            "rrule": "FREQ=WEEKLY;BYDAY=WE",
            "event_start_time": None,
            "event_end_time": None,
            "event_is_all_day": True,
            "event_description": "週循環全天",
        },
        {
            "name": f"{PREFIX} 每日晨檢",
            "rrule": "FREQ=DAILY",
            "event_start_time": "08:00",
            "event_end_time": "08:15",
            "event_description": "日循環",
        },
        {
            "name": f"{PREFIX} 隔日運動",
            "rrule": "FREQ=DAILY;INTERVAL=2",
            "event_start_time": "19:00",
            "event_end_time": "20:00",
            "event_description": "INTERVAL=2",
        },
        {
            "name": f"{PREFIX} 每月 1 號結算",
            "rrule": "FREQ=MONTHLY;BYMONTHDAY=1",
            "event_start_time": "10:00",
            "event_end_time": "11:00",
            "event_description": "月循環",
        },
        {
            "name": f"{PREFIX} 測試組週五回顧",
            "rrule": "FREQ=WEEKLY;BYDAY=FR",
            "event_start_time": "16:00",
            "event_end_time": "17:00",
            "workset_id": WS_ID,
            "event_description": "其他 workset 循環",
        },
        {
            "name": f"{PREFIX} 專案子循環任務",
            "rrule": "FREQ=WEEKLY;BYDAY=TU,TH",
            "event_start_time": "11:00",
            "event_end_time": "11:30",
            "parent_task_id": PROJECT_TASK_ID,
            "event_description": "project 子 recurring",
        },
    ]
    for spec in recurring_specs:
        rkwargs: dict = {
            "name": spec["name"],
            "rrule": spec["rrule"],
            "event_start_time": spec.get("event_start_time"),
            "event_end_time": spec.get("event_end_time"),
            "event_is_all_day": bool(spec.get("event_is_all_day", False)),
            "event_location": spec.get("event_location"),
            "event_description": spec.get("event_description"),
            "parent_task_id": spec.get("parent_task_id"),
            "description": "cal-ui fixture",
        }
        if "workset_id" in spec:
            rkwargs["workset_id"] = spec["workset_id"]
        await create_recurring_task(db, **rkwargs)
        counts["recurring"] += 1

    # ── items: purchase / remind / expiry projections ──
    item_specs = [
        {
            "title": f"{PREFIX} 牛奶（即將過期）",
            "purchased_at": "2026-08-01",
            "expires_at": "2026-08-08",
            "remind_before_days": 3,
            "emoji": "🥛",
            "notes": "應出現購買日、提醒日、過期日",
        },
        {
            "title": f"{PREFIX} 護照（遠期）",
            "purchased_at": None,
            "expires_at": "2026-12-01",
            "remind_before_days": 30,
            "emoji": "🛂",
            "notes": "遠期過期 + 提前提醒",
        },
        {
            "title": f"{PREFIX} 已過期優格",
            "purchased_at": "2026-07-20",
            "expires_at": "2026-08-01",
            "remind_before_days": 2,
            "emoji": "🫙",
            "notes": "已過期（過去）",
        },
        {
            "title": f"{PREFIX} 本週過期藥品",
            "purchased_at": "2026-07-01",
            "expires_at": "2026-08-06",
            "remind_before_days": 5,
            "emoji": "💊",
            "workset_id": WS_ID,
            "notes": "其他 workset 物品",
        },
        {
            "title": f"{PREFIX} 僅購買日無過期",
            "purchased_at": "2026-08-05",
            "expires_at": None,
            "remind_before_days": None,
            "emoji": "📦",
            "notes": "只有 purchased 投影",
        },
    ]
    item_ids: list[str] = []
    for spec in item_specs:
        row = await create_item(
            db,
            title=spec["title"],
            purchased_at=spec.get("purchased_at"),
            expires_at=spec.get("expires_at"),
            remind_before_days=spec.get("remind_before_days"),
            emoji=spec.get("emoji"),
            notes=spec.get("notes", ""),
            workset_id=spec.get("workset_id"),
        )
        item_ids.append(str(row["id"]))
        counts["items"] += 1

    if item_ids:
        # Item calendar occurrence ids are usually like `item:{id}:expires` etc.
        # Dismiss using a synthetic known pattern from query — soft-dismiss by item source
        # with the raw item id still works for some UI paths; prefer occurrence after query.
        await dismiss_timeline_event(db, source="item", event_id=f"item:{item_ids[0]}:expires")
        counts["dismissals"] += 1

    # ── analysis_events (intel / web) for Timeline source=analysis ──
    analysis_specs = [
        {
            "id": "cal-ui-ae-meeting",
            "task_id": INTEL_TASK_ID,
            "title": f"{PREFIX} 情報：明日路演",
            "body": "來自 intel_event 的定時發現",
            "start": "2026-08-06T14:00:00+08:00",
            "end": "2026-08-06T16:00:00+08:00",
            "location": "會展中心",
            "lat": 22.301,
            "lon": 114.172,
        },
        {
            "id": "cal-ui-ae-multiday",
            "task_id": INTEL_TASK_ID,
            "title": f"{PREFIX} 情報：三日論壇",
            "body": "跨日 analysis 事件",
            "start": "2026-08-13T09:00:00+08:00",
            "end": "2026-08-15T17:00:00+08:00",
            "location": "灣仔",
        },
        {
            "id": "cal-ui-ae-overnight",
            "task_id": INTEL_TASK_ID,
            "title": f"{PREFIX} 情報：跨夜活動",
            "body": " overnight analysis",
            "start": "2026-08-08T21:00:00+08:00",
            "end": "2026-08-09T01:00:00+08:00",
            "location": "蘭桂坊",
        },
        {
            "id": "cal-ui-ae-untimed",
            "task_id": INTEL_TASK_ID,
            "title": f"{PREFIX} 情報：無時間發現（不進日曆格）",
            "body": "start_time=NULL — Timeline 列表可能另處理",
            "start": None,
            "end": None,
            "location": "N/A",
        },
        {
            "id": "cal-ui-ae-web",
            "task_id": WEB_TASK_ID,
            "title": f"{PREFIX} 網情報：產品發布",
            "body": "web_intel timed",
            "start": "2026-08-09T10:00:00+08:00",
            "end": "2026-08-09T11:00:00+08:00",
            "location": "線上",
        },
    ]
    for spec in analysis_specs:
        # web_intel events need their own batch FK — reuse intel batch only for INTEL_TASK_ID
        if spec["task_id"] != INTEL_TASK_ID:
            web_batch = "cal-ui-web-batch"
            now = utc_now_iso()
            exists = await db.fetch_one("SELECT id FROM analysis_batches WHERE id = ?", (web_batch,))
            if not exists:
                await db.execute(
                    "INSERT INTO analysis_batches (id, task_id, version, status, "
                    "message_count, retry_count, error_message, agent_message, created_at, "
                    "updated_at, completed_at) VALUES (?, ?, 1, 'completed', 1, 0, '', '', ?, ?, ?)",
                    (web_batch, WEB_TASK_ID, now, now, now),
                )
            # temporarily swap batch via direct insert variant
            await db.execute(
                "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
                "start_time, end_time, location, latitude, longitude, participants_json, "
                "source_message_id, batch_source_channel_names, content_hash, semantic_hash, "
                "event_key, created_at, updated_at) "
                "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, '[]', NULL, ?, ?, ?, ?, ?, ?)",
                (
                    spec["id"],
                    spec["task_id"],
                    web_batch,
                    spec["title"],
                    spec["body"],
                    spec["start"],
                    spec["end"],
                    spec.get("location", ""),
                    spec.get("lat"),
                    spec.get("lon"),
                    json.dumps(["cal-ui-seed"]),
                    _hash(spec["id"] + "c"),
                    _hash(spec["id"] + "s"),
                    spec["id"],
                    now,
                    now,
                ),
            )
        else:
            await _insert_analysis_event(
                db,
                event_id=spec["id"],
                task_id=spec["task_id"],
                title=spec["title"],
                body=spec["body"],
                start=spec["start"],
                end=spec["end"],
                location=spec.get("location", ""),
                lat=spec.get("lat"),
                lon=spec.get("lon"),
            )
        counts["analysis_events"] += 1

    await dismiss_timeline_event(db, source="analysis", event_id="cal-ui-ae-meeting")
    counts["dismissals"] += 1

    return counts


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clean", action="store_true", help="Remove prior [cal-ui] fixtures first")
    parser.add_argument("--db", type=str, default="", help="Override SQLite path")
    args = parser.parse_args()

    path = Path(args.db) if args.db else default_db_path()
    print(f"DB: {path}")
    db = Database(str(path))
    await db.connect()
    try:
        if args.clean:
            await _clean(db)
            print("Cleaned prior [cal-ui] fixtures")
        counts = await seed(db)
        print("Seeded:", json.dumps(counts, ensure_ascii=False))
        print("Open /timeline — filter by workset「日曆 UI 測試組」or titles starting with [cal-ui]")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
