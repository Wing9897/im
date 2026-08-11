"""Seed calendar events and items for local dev manual testing.

Prefix: ``[dev-seed]`` on titles for easy identification / cleanup.
No analysis tasks, recurring tasks, or analysis_events — calendar + items only.

  python scripts/seed_dev_items_calendar.py
  python scripts/seed_dev_items_calendar.py --clean   # remove prior [dev-seed] rows first
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.calendar.timeline_dismissals import dismiss_timeline_event
from server.calendar.timeline_importance import mark_timeline_important
from server.calendar.user_events import create_user_event
from server.db.database import Database, TransactionDb
from server.items.service import create_category, create_item, patch_item
from server.paths import default_db_path
from server.queries.items_queries import fetch_category_by_slug
from server.queries.worksets_queries import insert_workset
from server.util import utc_now_iso

PREFIX = "[dev-seed]"
WS_ID = "ws-dev-seed-demo"
ELECTRONICS_SLUG = "dev_seed_electronics"


async def _clean(db: Database) -> None:
    """Remove previous fixture rows (best-effort by title / known ids)."""
    await db.execute("DELETE FROM timeline_dismissals WHERE event_id LIKE 'dev-seed-%'")
    await db.execute(
        "DELETE FROM timeline_importance WHERE event_id IN "
        "(SELECT id FROM user_events WHERE title LIKE ? OR id LIKE 'dev-seed-%')",
        (f"{PREFIX}%",),
    )
    await db.execute(
        "DELETE FROM user_events WHERE title LIKE ? OR id LIKE 'dev-seed-%'",
        (f"{PREFIX}%",),
    )
    await db.execute(
        "DELETE FROM user_events WHERE item_id IN (SELECT id FROM items WHERE title LIKE ?)",
        (f"{PREFIX}%",),
    )
    await db.execute("DELETE FROM items WHERE title LIKE ?", (f"{PREFIX}%",))
    await db.execute("DELETE FROM item_categories WHERE slug = ?", (ELECTRONICS_SLUG,))
    await db.execute("DELETE FROM worksets WHERE id = ?", (WS_ID,))


async def _ensure_workset(db: Database) -> None:
    existing = await db.fetch_one("SELECT id FROM worksets WHERE id = ?", (WS_ID,))
    if existing:
        return
    async with db.transaction() as conn:
        await insert_workset(
            TransactionDb(conn),
            workset_id=WS_ID,
            name="Dev Seed 測試組",
            now=utc_now_iso(),
        )


async def _category_id(db: Database, slug: str) -> str:
    row = await fetch_category_by_slug(db, slug)
    if row is None:
        raise RuntimeError(f"built-in category slug missing: {slug}")
    return str(row["id"])


async def _ensure_electronics_category(db: Database) -> str:
    row = await fetch_category_by_slug(db, ELECTRONICS_SLUG)
    if row:
        return str(row["id"])
    created = await create_category(
        db,
        name=f"{PREFIX} 電子產品",
        slug=ELECTRONICS_SLUG,
        sort_order=25,
        color="#6366F1",
        emoji="💻",
        default_remind_before_days=14,
    )
    return str(created["id"])


async def _link_item_milestone(
    db: Database,
    *,
    item_id: str,
    title: str,
    day: str,
    workset_id: str | None = None,
    remind_before_days: int | None = None,
    kind: str | None = None,
) -> None:
    from server.calendar.user_event_kinds import infer_user_event_kind_from_title

    await create_user_event(
        db,
        title=title,
        start_time=f"{day}T00:00:00Z",
        is_all_day=True,
        item_id=item_id,
        workset_id=workset_id,
        remind_before_days=remind_before_days,
        kind=kind or infer_user_event_kind_from_title(title),
        origin="manual",
    )


async def seed(db: Database) -> dict[str, int]:
    await _ensure_workset(db)
    counts = {
        "categories_created": 0,
        "user_events": 0,
        "items": 0,
        "important": 0,
        "dismissals": 0,
    }

    cat_passport = await _category_id(db, "passport_docs")
    cat_medicine = await _category_id(db, "medicine")
    cat_subscription = await _category_id(db, "subscription")
    cat_warranty = await _category_id(db, "warranty")
    cat_food = await _category_id(db, "food")
    cat_credit = await _category_id(db, "credit_card")

    electronics_before = await fetch_category_by_slug(db, ELECTRONICS_SLUG)
    cat_electronics = await _ensure_electronics_category(db)
    if electronics_before is None:
        counts["categories_created"] += 1

    # ── items: diverse categories, notes, archived, linked「到期」milestones ──
    item_specs: list[dict] = [
        {
            "title": f"{PREFIX} 護照（遠期到期）",
            "category_id": cat_passport,
            "emoji": "🛂",
            "notes": "證件：K12345678 · 香港入境事務處",
            "expires_at": "2029-03-14",
            "remind_before_days": 90,
        },
        {
            "title": f"{PREFIX} MacBook Pro 14",
            "category_id": cat_electronics,
            "emoji": "💻",
            "notes": 'Apple MacBook Pro 14" M3 Pro · C02XK9ABCDEF',
            "expires_at": "2027-11-01",
            "remind_before_days": 30,
        },
        {
            "title": f"{PREFIX} iPhone 15 Pro",
            "category_id": cat_warranty,
            "emoji": "📱",
            "notes": "F2LM9Q8R10 · Apple Store 銅鑼灣",
            "expires_at": "2026-06-20",
            "remind_before_days": 14,
        },
        {
            "title": f"{PREFIX} Netflix 家庭方案",
            "category_id": cat_subscription,
            "emoji": "🎬",
            "notes": "Netflix Premium 4K · 月付",
            "expires_at": "2026-09-10",
            "remind_before_days": 7,
        },
        {
            "title": f"{PREFIX} Spotify Premium",
            "category_id": cat_subscription,
            "emoji": "🎵",
            "notes": "Spotify Individual",
            "expires_at": "2026-08-20",
            "remind_before_days": 3,
        },
        {
            "title": f"{PREFIX} 布洛芬緩釋膠囊",
            "category_id": cat_medicine,
            "emoji": "💊",
            "notes": "每次 1 粒，每日 2 次 · 萬寧 中環店",
            "expires_at": "2026-08-10",
            "remind_before_days": 5,
        },
        {
            "title": f"{PREFIX} 維他命 D3（已過期）",
            "category_id": cat_medicine,
            "emoji": "🧴",
            "notes": "每日 1 粒 · 屈臣氏",
            "expires_at": "2026-07-01",
            "remind_before_days": 7,
        },
        {
            "title": f"{PREFIX} 有機全脂牛奶",
            "category_id": cat_food,
            "emoji": "🥛",
            "notes": "Organic Valley · 冷藏 2–4°C",
            "expires_at": "2026-08-12",
            "remind_before_days": 2,
        },
        {
            "title": f"{PREFIX} 滙豐 Visa 白金卡",
            "category_id": cat_credit,
            "emoji": "💳",
            "notes": "HSBC · 4829",
            "expires_at": "2028-03-31",
            "remind_before_days": 60,
        },
        {
            "title": f"{PREFIX} 舊款 iPad（已歸檔）",
            "category_id": cat_electronics,
            "emoji": "📱",
            "status": "archived",
            "notes": "Apple iPad Air 4 · DLXM2ABCDEF",
            "expires_at": None,
        },
        {
            "title": f"{PREFIX} 無到期日",
            "category_id": cat_food,
            "emoji": "📦",
            "notes": "雜牌 · 室溫",
            "expires_at": None,
        },
        {
            "title": f"{PREFIX} 測試組物品",
            "category_id": cat_medicine,
            "workset_id": WS_ID,
            "emoji": "🩹",
            "notes": "外用 · 社區藥房",
            "expires_at": "2026-08-15",
            "remind_before_days": 3,
        },
    ]

    item_ids: list[str] = []
    for spec in item_specs:
        row = await create_item(
            db,
            title=spec["title"],
            category_id=spec.get("category_id"),
            emoji=spec.get("emoji"),
            notes=spec.get("notes", ""),
            workset_id=spec.get("workset_id"),
            status=spec.get("status", "active"),
        )
        item_id = str(row["id"])
        item_ids.append(item_id)
        counts["items"] += 1

        if spec.get("status") == "archived":
            await patch_item(db, item_id, status="archived")

        workset_id = spec.get("workset_id")
        if spec.get("expires_at"):
            await _link_item_milestone(
                db,
                item_id=item_id,
                title="到期",
                day=spec["expires_at"],
                workset_id=workset_id,
                remind_before_days=spec.get("remind_before_days"),
            )
            counts["user_events"] += 1

    # ── standalone user_events ──
    user_specs: list[dict] = [
        {
            "title": f"{PREFIX} 週一產品站會",
            "start_time": "2026-08-11T09:30:00+08:00",
            "end_time": "2026-08-11T10:30:00+08:00",
            "body": "定時會議 · 有 remind",
            "location": "Zoom · Room A",
            "remind_before_days": 1,
            "important": True,
        },
        {
            "title": f"{PREFIX} 合約簽署截止",
            "start_time": "2026-08-08T17:00:00+08:00",
            "end_time": None,
            "body": "僅開始時間 · deadline 樣式",
            "remind_before_days": 2,
            "important": True,
        },
        {
            "title": f"{PREFIX} 跨夜值班",
            "start_time": "2026-08-09T22:00:00+08:00",
            "end_time": "2026-08-10T06:00:00+08:00",
            "body": "跨午夜連續時段",
            "location": "NOC",
        },
        {
            "title": f"{PREFIX} 三日出差",
            "start_time": "2026-08-13T08:00:00+08:00",
            "end_time": "2026-08-15T20:00:00+08:00",
            "body": "跨日定時",
            "location": "台北",
        },
        {
            "title": f"{PREFIX} 全日休假",
            "start_time": "2026-08-16T00:00:00+08:00",
            "end_time": "2026-08-17T00:00:00+08:00",
            "body": "單日全天",
            "is_all_day": True,
        },
        {
            "title": f"{PREFIX} 三日全天營",
            "start_time": "2026-08-18T00:00:00+08:00",
            "end_time": "2026-08-21T00:00:00+08:00",
            "body": "跨日全天",
            "location": "西貢",
            "is_all_day": True,
        },
        {
            "title": f"{PREFIX} 助手建立事件",
            "start_time": "2026-08-07T14:00:00+08:00",
            "end_time": "2026-08-07T14:45:00+08:00",
            "origin": "assistant",
            "body": "origin=assistant",
        },
        {
            "title": f"{PREFIX} 重疊 A",
            "start_time": "2026-08-10T10:00:00+08:00",
            "end_time": "2026-08-10T12:00:00+08:00",
            "body": "堆疊 UI 測試",
        },
        {
            "title": f"{PREFIX} 重疊 B",
            "start_time": "2026-08-10T11:00:00+08:00",
            "end_time": "2026-08-10T13:00:00+08:00",
            "body": "堆疊 UI 測試",
        },
        {
            "title": f"{PREFIX} 測試組會議",
            "start_time": "2026-08-12T15:00:00+08:00",
            "end_time": "2026-08-12T16:00:00+08:00",
            "workset_id": WS_ID,
            "body": "workset 篩選",
            "location": "Dev Seed 測試組",
        },
        {
            "title": f"{PREFIX} 月末跨月",
            "start_time": "2026-08-31T20:00:00+08:00",
            "end_time": "2026-09-01T02:00:00+08:00",
            "body": "跨月 overnight",
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
            "remind_before_days": spec.get("remind_before_days"),
        }
        if "workset_id" in spec:
            kwargs["workset_id"] = spec["workset_id"]
        item = await create_user_event(db, **kwargs)
        event_id = str(item["id"])
        created_user_ids.append(event_id)
        counts["user_events"] += 1
        if spec.get("important"):
            await mark_timeline_important(db, source="user", event_id=event_id)
            counts["important"] += 1

    # Soft-dismiss one standalone event + one item remind projection (restore UI).
    if created_user_ids:
        await dismiss_timeline_event(db, source="user", event_id=created_user_ids[-1])
        counts["dismissals"] += 1
    if item_ids:
        await dismiss_timeline_event(db, source="item", event_id=f"item:{item_ids[0]}:remind")
        counts["dismissals"] += 1

    return counts


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clean", action="store_true", help="Remove prior [dev-seed] fixtures first")
    parser.add_argument("--db", type=str, default="", help="Override SQLite path")
    args = parser.parse_args()

    path = Path(args.db) if args.db else default_db_path()
    print(f"DB: {path}")
    if not path.is_file():
        print("Warning: database file does not exist yet; schema will be bootstrapped.")

    db = Database(str(path))
    await db.connect()
    try:
        await db.ensure_schema()
        if args.clean:
            await _clean(db)
            print("Cleaned prior [dev-seed] fixtures")
        counts = await seed(db)
        print("Seeded:", json.dumps(counts, ensure_ascii=False))
        print("Open /timeline or /items — filter titles starting with [dev-seed] or workset「Dev Seed 測試組」")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
