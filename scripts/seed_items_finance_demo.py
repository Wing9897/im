"""Seed items + linked calendars (all 3 kinds) + purchase amounts for manual QA.

Prefix: ``[finance-demo]`` on titles for easy identification / cleanup.
Uses real ``create_item`` + ``create_user_event`` (kind / amount / direction).

  uv run python scripts/seed_items_finance_demo.py
  uv run python scripts/seed_items_finance_demo.py --clean
  uv run python scripts/seed_items_finance_demo.py --verify-only

After a stamp wipe (or older local DB):

  uv run python scripts/reset_local_databases.py --apply
  uv run python scripts/seed_items_finance_demo.py
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.calendar.user_event_kinds import (  # noqa: E402
    USER_EVENT_KIND_EXPIRES,
    USER_EVENT_KIND_NORMAL,
    USER_EVENT_KIND_PURCHASE_EFFECTIVE,
)
from server.calendar.user_events import create_user_event  # noqa: E402
from server.db.database import Database, TransactionDb  # noqa: E402
from server.items.service import create_item  # noqa: E402
from server.paths import default_db_path  # noqa: E402
from server.queries.items_queries import fetch_category_by_slug  # noqa: E402
from server.queries.worksets_queries import insert_workset  # noqa: E402
from server.util import utc_now_iso  # noqa: E402

PREFIX = "[finance-demo]"
WS_ID = "ws-finance-demo"


@dataclass
class LinkedEventSpec:
    title: str
    day: str
    kind: str
    remind_before_days: int | None = None
    amount: float | None = None
    direction: str | None = None
    body: str = ""


@dataclass
class ItemSpec:
    key: str
    title: str
    category_slug: str
    emoji: str
    notes: str
    workset_id: str | None = None
    events: list[LinkedEventSpec] = field(default_factory=list)


def _today() -> date:
    return date.today()


def _day(offset_days: int = 0) -> str:
    return (_today() + timedelta(days=offset_days)).isoformat()


def _demo_specs() -> list[ItemSpec]:
    """4–6 items covering expires / purchase_effective / normal + finance.

    Free-form details live in ``notes`` only (item attributes UI removed).
    """
    milk_expires = _day(3)  # soon — list badges
    return [
        ItemSpec(
            key="passport",
            title=f"{PREFIX} 護照",
            category_slug="passport_docs",
            emoji="🛂",
            notes=(
                "證件號 K99887766；簽發：香港入境事務處。"
                "關聯：primary expires + 第二張 expires（非 primary）+ normal 提醒。"
            ),
            workset_id=WS_ID,
            events=[
                LinkedEventSpec(
                    title="到期",
                    day="2030-05-20",
                    kind=USER_EVENT_KIND_EXPIRES,
                    remind_before_days=90,
                    body="primary expires（最早建立 → wire expiresAt）",
                ),
                LinkedEventSpec(
                    title="到期",
                    day="2032-01-15",
                    kind=USER_EVENT_KIND_EXPIRES,
                    remind_before_days=30,
                    body="第二張 expires — 不應成為 derive-on-read 主到期日",
                ),
                LinkedEventSpec(
                    title="續簽提醒",
                    day=_day(45),
                    kind=USER_EVENT_KIND_NORMAL,
                    remind_before_days=7,
                    body="普通提醒（無金額）",
                ),
            ],
        ),
        ItemSpec(
            key="camera",
            title=f"{PREFIX} 相機",
            category_slug="warranty",
            emoji="📷",
            notes="序號 CAM-DEMO-001；店家：相機店。關聯：purchase_effective 支出 + 二手賣出收入。",
            events=[
                LinkedEventSpec(
                    title="購入",
                    day=_day(-8),
                    kind=USER_EVENT_KIND_PURCHASE_EFFECTIVE,
                    amount=12800.0,
                    direction="expense",
                    body="購買支出（落在本月，方便 /items/finance thisMonth）",
                ),
                LinkedEventSpec(
                    title="二手售出",
                    day=_day(-3),
                    kind=USER_EVENT_KIND_PURCHASE_EFFECTIVE,
                    amount=3500.0,
                    direction="income",
                    body="轉售收入（標題非購入亦可）",
                ),
            ],
        ),
        ItemSpec(
            key="milk",
            title=f"{PREFIX} 有機全脂牛奶",
            category_slug="food",
            emoji="🥛",
            notes=f"品牌 Organic Valley；冷藏 2–4°C。即將到期（{milk_expires}）— 列表徽章。",
            events=[
                LinkedEventSpec(
                    title="到期",
                    day=milk_expires,
                    kind=USER_EVENT_KIND_EXPIRES,
                    remind_before_days=2,
                ),
            ],
        ),
        ItemSpec(
            key="subscription",
            title=f"{PREFIX} Netflix 訂閱",
            category_slug="subscription",
            emoji="🎬",
            notes="方案 Premium 4K。關聯：purchase_effective 支出 + expires。",
            events=[
                LinkedEventSpec(
                    title="購入",
                    day=_day(-2),
                    kind=USER_EVENT_KIND_PURCHASE_EFFECTIVE,
                    amount=168.0,
                    direction="expense",
                    body="本月訂閱費",
                ),
                LinkedEventSpec(
                    title="到期",
                    day=_day(28),
                    kind=USER_EVENT_KIND_EXPIRES,
                    remind_before_days=7,
                ),
            ],
        ),
        ItemSpec(
            key="plain",
            title=f"{PREFIX} 筆記本",
            category_slug="household",
            emoji="📓",
            notes="品牌 MUJI；位置書桌。僅 normal 行事曆，無金額。",
            events=[
                LinkedEventSpec(
                    title="補貨提醒",
                    day=_day(14),
                    kind=USER_EVENT_KIND_NORMAL,
                    remind_before_days=3,
                    body="普通行事曆",
                ),
            ],
        ),
        ItemSpec(
            key="renamed_expiry",
            title=f"{PREFIX} 保固卡（自訂到期標題）",
            category_slug="warranty",
            emoji="🛡️",
            notes=("序號 WRN-RENAMED。kind=expires 但標題≠「到期」—徽章看 kind / wire expiresAt，不是標題。"),
            events=[
                LinkedEventSpec(
                    title="保固截止日",
                    day=_day(60),
                    kind=USER_EVENT_KIND_EXPIRES,
                    remind_before_days=14,
                    body="自訂標題，kind 仍為 expires",
                ),
            ],
        ),
    ]


async def _clean(db: Database) -> None:
    await db.execute(
        "DELETE FROM timeline_importance WHERE event_id IN "
        "(SELECT id FROM user_events WHERE title LIKE ? OR id LIKE 'fin-demo-%')",
        (f"{PREFIX}%",),
    )
    await db.execute(
        "DELETE FROM timeline_dismissals WHERE event_id IN "
        "(SELECT id FROM user_events WHERE title LIKE ? OR id LIKE 'fin-demo-%')",
        (f"{PREFIX}%",),
    )
    await db.execute(
        "DELETE FROM user_events WHERE title LIKE ? OR id LIKE 'fin-demo-%'",
        (f"{PREFIX}%",),
    )
    await db.execute(
        "DELETE FROM user_events WHERE item_id IN (SELECT id FROM items WHERE title LIKE ?)",
        (f"{PREFIX}%",),
    )
    await db.execute("DELETE FROM items WHERE title LIKE ?", (f"{PREFIX}%",))
    await db.execute("DELETE FROM worksets WHERE id = ?", (WS_ID,))


async def _ensure_workset(db: Database) -> None:
    existing = await db.fetch_one("SELECT id FROM worksets WHERE id = ?", (WS_ID,))
    if existing:
        return
    async with db.transaction() as conn:
        await insert_workset(
            TransactionDb(conn),
            workset_id=WS_ID,
            name="Finance Demo 測試組",
            now=utc_now_iso(),
        )


async def _category_id(db: Database, slug: str) -> str:
    row = await fetch_category_by_slug(db, slug)
    if row is None:
        raise RuntimeError(f"built-in category slug missing: {slug}")
    return str(row["id"])


async def _link_event(
    db: Database,
    *,
    item_id: str,
    workset_id: str | None,
    spec: LinkedEventSpec,
) -> dict[str, Any]:
    return await create_user_event(
        db,
        title=spec.title,
        start_time=f"{spec.day}T00:00:00Z",
        is_all_day=True,
        item_id=item_id,
        workset_id=workset_id,
        remind_before_days=spec.remind_before_days,
        kind=spec.kind,
        amount=spec.amount,
        direction=spec.direction,
        body=spec.body,
        origin="manual",
    )


async def seed(db: Database) -> dict[str, Any]:
    await _ensure_workset(db)
    summary_items: list[dict[str, Any]] = []
    event_count = 0

    for item_spec in _demo_specs():
        cat_id = await _category_id(db, item_spec.category_slug)
        row = await create_item(
            db,
            title=item_spec.title,
            category_id=cat_id,
            emoji=item_spec.emoji,
            notes=item_spec.notes,
            workset_id=item_spec.workset_id,
        )
        item_id = str(row["id"])
        linked: list[dict[str, Any]] = []
        for idx, ev_spec in enumerate(item_spec.events):
            created = await _link_event(
                db,
                item_id=item_id,
                workset_id=item_spec.workset_id,
                spec=ev_spec,
            )
            event_count += 1
            linked.append(
                {
                    "id": created["id"],
                    "title": created["title"],
                    "kind": created["kind"],
                    "day": ev_spec.day,
                    "amount": created.get("amount"),
                    "direction": created.get("direction"),
                }
            )
            # utc_now_iso is second-precision; primary expires = earliest created_at.
            # Wait so a later expires row cannot tie and win via id ASC.
            if idx + 1 < len(item_spec.events):
                await asyncio.sleep(1.05)

        item_row = await db.fetch_one(
            """
            SELECT
              i.id,
              i.title,
              CASE
                WHEN pe.start_time IS NULL THEN NULL
                ELSE substr(pe.start_time, 1, 10)
              END AS expires_at,
              pe.remind_before_days AS remind_before_days
            FROM items i
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
            WHERE i.id = ?
            """,
            (item_id,),
        )
        assert item_row is not None
        summary_items.append(
            {
                "key": item_spec.key,
                "id": item_id,
                "title": item_spec.title,
                "category": item_spec.category_slug,
                "expires_at": item_row.get("expires_at"),
                "remind_before_days": item_row.get("remind_before_days"),
                "calendars": linked,
            }
        )

    return {"items": summary_items, "user_events": event_count}


def _expected_finance() -> dict[str, float]:
    expense = 12800.0 + 168.0
    income = 3500.0
    return {
        "total_expense": expense,
        "total_income": income,
        "net": expense - income,
    }


async def verify(db: Database) -> dict[str, Any]:
    """Assert kinds, derived primary expiresAt, and finance aggregation."""
    errors: list[str] = []
    items = await db.fetch_all(
        """
        SELECT
          i.id,
          i.title,
          CASE
            WHEN pe.start_time IS NULL THEN NULL
            ELSE substr(pe.start_time, 1, 10)
          END AS expires_at,
          pe.remind_before_days AS remind_before_days
        FROM items i
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
        WHERE i.title LIKE ?
        ORDER BY i.title
        """,
        (f"{PREFIX}%",),
    )
    if len(items) != 6:
        errors.append(f"expected 6 demo items, found {len(items)}")

    by_title = {str(r["title"]): r for r in items}
    expected_primary = {
        f"{PREFIX} 護照": ("2030-05-20", 90),
        f"{PREFIX} 有機全脂牛奶": (_day(3), 2),
        f"{PREFIX} Netflix 訂閱": (_day(28), 7),
        f"{PREFIX} 保固卡（自訂到期標題）": (_day(60), 14),
        f"{PREFIX} 相機": (None, None),
        f"{PREFIX} 筆記本": (None, None),
    }
    for title, (exp_day, remind) in expected_primary.items():
        row = by_title.get(title)
        if row is None:
            errors.append(f"missing item: {title}")
            continue
        got_exp = row.get("expires_at")
        got_remind = row.get("remind_before_days")
        if got_exp != exp_day:
            errors.append(f"{title}: expires_at={got_exp!r} expected {exp_day!r}")
        if got_remind != remind:
            errors.append(f"{title}: remind_before_days={got_remind!r} expected {remind!r}")

    # Kind / amount checks per linked event
    events = await db.fetch_all(
        """
        SELECT ue.id, ue.title, ue.kind, ue.amount, ue.direction, ue.start_time, i.title AS item_title
        FROM user_events ue
        JOIN items i ON i.id = ue.item_id
        WHERE i.title LIKE ?
        ORDER BY i.title, ue.created_at, ue.id
        """,
        (f"{PREFIX}%",),
    )
    kinds_by_item: dict[str, list[str]] = {}
    for ev in events:
        kinds_by_item.setdefault(str(ev["item_title"]), []).append(str(ev["kind"]))
        kind = str(ev["kind"])
        if kind not in {
            USER_EVENT_KIND_NORMAL,
            USER_EVENT_KIND_EXPIRES,
            USER_EVENT_KIND_PURCHASE_EFFECTIVE,
        }:
            errors.append(f"bad kind on {ev['id']}: {kind}")
        if kind != USER_EVENT_KIND_PURCHASE_EFFECTIVE:
            if ev.get("amount") is not None or ev.get("direction") is not None:
                errors.append(
                    f"non-purchase event {ev['id']} must clear finance "
                    f"(amount={ev.get('amount')}, direction={ev.get('direction')})"
                )
        else:
            if ev.get("amount") is None:
                errors.append(f"purchase_effective {ev['id']} missing amount")

    expected_kinds = {
        f"{PREFIX} 護照": Counter(
            {
                USER_EVENT_KIND_EXPIRES: 2,
                USER_EVENT_KIND_NORMAL: 1,
            }
        ),
        f"{PREFIX} 相機": Counter({USER_EVENT_KIND_PURCHASE_EFFECTIVE: 2}),
        f"{PREFIX} 有機全脂牛奶": Counter({USER_EVENT_KIND_EXPIRES: 1}),
        f"{PREFIX} Netflix 訂閱": Counter(
            {
                USER_EVENT_KIND_PURCHASE_EFFECTIVE: 1,
                USER_EVENT_KIND_EXPIRES: 1,
            }
        ),
        f"{PREFIX} 筆記本": Counter({USER_EVENT_KIND_NORMAL: 1}),
        f"{PREFIX} 保固卡（自訂到期標題）": Counter({USER_EVENT_KIND_EXPIRES: 1}),
    }
    for title, want in expected_kinds.items():
        got = Counter(kinds_by_item.get(title, []))
        if got != want:
            errors.append(f"{title}: kinds={dict(got)} expected {dict(want)}")

    # Renamed expiry still projects via kind
    renamed = next(
        (e for e in events if str(e["item_title"]).endswith("保固卡（自訂到期標題）")),
        None,
    )
    if renamed is None:
        errors.append("renamed expiry event missing")
    elif str(renamed["title"]) == "到期":
        errors.append("renamed expiry should not use title「到期」")
    elif str(renamed["kind"]) != USER_EVENT_KIND_EXPIRES:
        errors.append("renamed expiry must keep kind=expires")

    # Finance aggregation (same rules as web summarizeItemsFinance)
    total_expense = 0.0
    total_income = 0.0
    with_amount = 0
    for ev in events:
        if str(ev["kind"]) != USER_EVENT_KIND_PURCHASE_EFFECTIVE:
            continue
        amount = ev.get("amount")
        if amount is None:
            continue
        with_amount += 1
        amt = float(amount)
        if str(ev.get("direction") or "expense") == "income":
            total_income += amt
        else:
            total_expense += amt
    expected = _expected_finance()
    if round(total_expense, 2) != expected["total_expense"]:
        errors.append(f"total_expense={total_expense} expected {expected['total_expense']}")
    if round(total_income, 2) != expected["total_income"]:
        errors.append(f"total_income={total_income} expected {expected['total_income']}")
    net = total_expense - total_income
    if round(net, 2) != expected["net"]:
        errors.append(f"net={net} expected {expected['net']}")

    # Stamp sanity
    stamp_row = await db.fetch_one("PRAGMA user_version")
    stamp_val = list(stamp_row.values())[0] if stamp_row else None
    if int(stamp_val or -1) != 28:
        errors.append(f"schema stamp={stamp_val!r} expected 28")

    result = {
        "ok": not errors,
        "errors": errors,
        "item_count": len(items),
        "event_count": len(events),
        "finance": {
            "with_amount": with_amount,
            "total_expense": total_expense,
            "total_income": total_income,
            "net": net,
        },
        "expected_finance": expected,
    }
    if errors:
        raise AssertionError("verify failed:\n- " + "\n- ".join(errors))
    return result


def _print_table(seeded: dict[str, Any]) -> None:
    print("\n=== Finance demo dataset ===")
    print(f"{'key':<16} {'item_id':<28} {'expires_at':<12} calendars (kind / amount)")
    print("-" * 100)
    for item in seeded["items"]:
        cal_bits = []
        for cal in item["calendars"]:
            money = ""
            if cal.get("amount") is not None:
                money = f" {cal['amount']} {cal.get('direction') or ''}".rstrip()
            cal_bits.append(f"{cal['kind']}「{cal['title']}」@{cal['day']}{money}")
        print(f"{item['key']:<16} {item['id']:<28} {str(item.get('expires_at') or '—'):<12} " + "; ".join(cal_bits))
    fin = _expected_finance()
    print("\nExpected /items/finance totals (all purchase_effective):")
    print(f"  expense={fin['total_expense']:.2f}  income={fin['total_income']:.2f}  net={fin['net']:.2f}")
    print("\nManual checklist:")
    print("  1. /items — milk soon-badge; passport expiresAt=2030-05-20 (not 2032)")
    print("  2. Open passport / camera / subscription — chips show expires / purchase / normal")
    print("  3. Renamed warranty — badge from kind=expires even though title≠「到期」")
    print("  4. /items/finance — expense 12968 / income 3500 / net 9468 (widen range if needed)")


async def main() -> None:
    # Windows consoles often default to a legacy code page; keep TC titles readable.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8")
            except Exception:
                pass

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clean", action="store_true", help="Remove prior [finance-demo] rows first")
    parser.add_argument("--verify-only", action="store_true", help="Only run asserts (no seed)")
    parser.add_argument("--db", type=str, default="", help="Override SQLite path")
    args = parser.parse_args()

    path = Path(args.db) if args.db else default_db_path()
    print(f"DB: {path}")
    if not path.is_file() and not args.verify_only:
        print("Warning: database file missing; schema will be bootstrapped (stamp 29).")

    db = Database(str(path))
    await db.connect()
    try:
        await db.ensure_schema()
        stamp = await db.fetch_one("PRAGMA user_version")
        stamp_val = list(stamp.values())[0] if stamp else None
        print(f"Schema stamp: {stamp_val}")
        if int(stamp_val or 0) != 29:
            print(
                "ERROR: need stamp 29. Run:\n"
                "  uv run python scripts/reset_local_databases.py --apply\n"
                "then re-run this seed.",
                file=sys.stderr,
            )
            raise SystemExit(2)

        if args.verify_only:
            result = await verify(db)
            print("VERIFY OK:", json.dumps(result, ensure_ascii=False, indent=2))
            return

        if args.clean:
            await _clean(db)
            print("Cleaned prior [finance-demo] fixtures")

        seeded = await seed(db)
        _print_table(seeded)
        result = await verify(db)
        print("\nVERIFY OK:", json.dumps(result["finance"], ensure_ascii=False))
        print(f"Seeded items={len(seeded['items'])} user_events={seeded['user_events']}")
        print("Filter titles starting with [finance-demo] or workset「Finance Demo 測試組」")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
