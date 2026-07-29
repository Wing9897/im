"""Live project-mode eval: seed multi-domain projects, force real LLM ticks.

Opens the same SQLite DB as the running server (or default
``intelligence_monitor.db``), seeds disposable project fixtures, calls
``execute_project_tick`` directly (no product force-tick API), and writes a
JSON report plus a terminal summary.

Usage:
  npm run eval:project
  npm run eval:project -- --all-ticks
  npm run eval:project -- --dry-run
  npm run eval:project -- --output reports/project_live_eval.json

  # equivalent:
  uv run python scripts/project_live_eval.py
  uv run python scripts/project_live_eval.py --all-ticks
  uv run python scripts/project_live_eval.py --dry-run
  uv run python scripts/project_live_eval.py --output reports/project_live_eval.json

Does NOT wipe the database. Reset afterward with
``uv run python scripts/reset_local_databases.py --apply`` or Settings 完全重置.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from unittest.mock import patch

_SCRIPT_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _SCRIPT_DIR.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

from server.analyzer.llm_client import ConfigurableLlmClient  # noqa: E402
from server.constants import DB_PATH_ENV  # noqa: E402
from server.db.database import Database, TransactionDb  # noqa: E402
from server.ingestion import upsert_channel  # noqa: E402
from server.paths import default_db_path, ensure_data_dir  # noqa: E402
from server.queries.project_tick_queries import (  # noqa: E402
    store_project_message_cursor,
)
from server.queries.tasks_queries import (  # noqa: E402
    insert_analysis_task,
    replace_task_channels,
)
from server.scheduler.project_tick import (  # noqa: E402
    execute_project_tick,
)
from server.sse import SseBroadcaster  # noqa: E402
from server.user_events import create_user_event  # noqa: E402
from server.util import new_id, utc_now_iso  # noqa: E402

# ---------------------------------------------------------------------------
# Scenarios (multi-domain; bold disposable seed data)
# ---------------------------------------------------------------------------

#: Default hybrid set: diverse domains + one restraint (noise) case.
DEFAULT_TICK_IDS = (
    "ple-product",
    "ple-clinic",
    "ple-family",
    "ple-noise",
)


@dataclass
class SeedMessage:
    content: str
    sender: str = "EvalBot"
    offset_hours: int = 1


@dataclass
class SeedEvent:
    title: str
    start_time: str
    end_time: str | None = None
    body: str = ""
    location: str = ""


@dataclass
class SeedChild:
    name: str
    rrule: str
    event_start_time: str
    event_is_all_day: int = 0


@dataclass
class Scenario:
    id: str
    domain: str
    name: str
    prompt: str
    channel_name: str
    messages: list[SeedMessage] = field(default_factory=list)
    seed_events: list[SeedEvent] = field(default_factory=list)
    seed_children: list[SeedChild] = field(default_factory=list)
    #: If True, advance cursor past all messages so tick sees "no new messages".
    advance_cursor_to_end: bool = False
    tick_by_default: bool = False


SCENARIOS: list[Scenario] = [
    Scenario(
        id="ple-product",
        domain="engineering",
        name="[PLE] 產品上線里程碑",
        prompt=(
            "你是工程 PM。維護「智能監控 v2.0」上線計畫："
            "確保有（1）2026-07-30 10:00 UTC 內部 kickoff、"
            "（2）每週三 09:00 UTC 上線同步會議（子循環）、"
            "（3）2026-08-05 14:00 UTC 對外發布窗口。"
            "根據來源訊息調整／新增／停用本專案日程，忽略與上線無關的閒聊。"
        ),
        channel_name="eng-release-warroom",
        messages=[
            SeedMessage(
                "Kickoff 改到 2026-07-30 10:00 UTC，會議室 B，請所有 tech lead 參加。",
                sender="PM-Alice",
                offset_hours=1,
            ),
            SeedMessage(
                "請建立每週三 09:00 UTC 的上線同步，直到 GA。",
                sender="PM-Alice",
                offset_hours=2,
            ),
            SeedMessage(
                "對外發布窗口鎖定 2026-08-05 14:00–16:00 UTC，需凍結變更。",
                sender="Release-Lead",
                offset_hours=3,
            ),
        ],
        seed_events=[
            SeedEvent(
                title="舊版草稿 kickoff（待調整）",
                start_time="2026-07-29T10:00:00Z",
                end_time="2026-07-29T11:00:00Z",
                body="pre-seed — agent may reschedule",
            ),
        ],
        tick_by_default=True,
    ),
    Scenario(
        id="ple-education",
        domain="education",
        name="[PLE] 秋季招生課程時程",
        prompt=(
            "你是教務助理。維護「2026 秋季招生」專案日程："
            "說明會、試聽課、報名截止日。根據訊息建立／調整事件與循環課表。"
        ),
        channel_name="admissions-ops",
        messages=[
            SeedMessage(
                "線上說明會訂在 2026-08-01 19:00–20:30（台北時間請用 UTC：2026-08-01T11:00:00Z）。",
                sender="教務-林",
                offset_hours=1,
            ),
            SeedMessage(
                "Python 入門試聽：每週六 14:00 UTC，從 8 月起連續 4 週。",
                sender="教務-林",
                offset_hours=2,
            ),
            SeedMessage(
                "報名截止：2026-08-20 23:59 UTC，請標成全日事件。",
                sender="招生主任",
                offset_hours=3,
            ),
        ],
        tick_by_default=False,
    ),
    Scenario(
        id="ple-clinic",
        domain="healthcare_ops",
        name="[PLE] 診所門診改期",
        prompt=(
            "你是診所營運助理（非臨床診斷）。維護門診排班與改期通知對應的日程："
            "醫師出診、臨時停診、改期後的補診。只做營運日程，不做醫療建議。"
        ),
        channel_name="clinic-front-desk",
        messages=[
            SeedMessage(
                "王醫師原定 2026-07-28 上午門診取消；改為 2026-07-29 09:00–12:00 UTC 補診。",
                sender="櫃檯-小陳",
                offset_hours=1,
            ),
            SeedMessage(
                "請新增每週二、四 13:00 UTC 的例行門診（子循環），名稱「王醫師午後門診」。",
                sender="院長室",
                offset_hours=2,
            ),
            SeedMessage(
                "牙科設備維修：2026-07-31 全日停診，標記為全日事件。",
                sender="設備組",
                offset_hours=3,
            ),
        ],
        seed_events=[
            SeedEvent(
                title="王醫師門診（原時段）",
                start_time="2026-07-28T01:00:00Z",
                end_time="2026-07-28T05:00:00Z",
                body="應改期或取消",
            ),
        ],
        tick_by_default=True,
    ),
    Scenario(
        id="ple-expo",
        domain="marketing",
        name="[PLE] 展會行銷活動",
        prompt=("你是行銷 PM。維護「AI Expo 台北」展位與活動時程：搭建、開幕、Demo 場次、拆展。依訊息更新日程。"),
        channel_name="marketing-expo",
        messages=[
            SeedMessage(
                "搭建日：2026-09-10 全日。開幕酒會：2026-09-11 18:00 UTC。",
                sender="Event-Ops",
                offset_hours=1,
            ),
            SeedMessage(
                "產品 Demo：每天 11:00 與 15:00 UTC（9/11–9/13），建子循環或多次事件皆可。",
                sender="Demo-Lead",
                offset_hours=2,
            ),
        ],
        tick_by_default=False,
    ),
    Scenario(
        id="ple-family",
        domain="life",
        name="[PLE] 家庭旅行協調",
        prompt=(
            "你是家庭行程協調助手。維護「暑假北海道」旅行日程：航班、飯店入住、景點預約。依群組訊息建立／調整事件。"
        ),
        channel_name="family-trip-chat",
        messages=[
            SeedMessage(
                "去程：2026-08-12 02:30 UTC 桃園→新千歲。回程：2026-08-18 08:00 UTC。",
                sender="爸",
                offset_hours=1,
            ),
            SeedMessage(
                "札幌飯店 check-in 2026-08-12 15:00 當地（用 2026-08-12T06:00:00Z），住 5 晚。",
                sender="媽",
                offset_hours=2,
            ),
            SeedMessage(
                "旭山動物園預約 2026-08-14 10:00 UTC，記得寫進行程。",
                sender="小孩",
                offset_hours=3,
            ),
        ],
        tick_by_default=True,
    ),
    Scenario(
        id="ple-news",
        domain="intel_media",
        name="[PLE] 多來源新聞監控",
        prompt=(
            "你是情報彙整助手。本專案追蹤「半導體出口管制」相關動態。"
            "把明確的發布會／聽證會／簡報時程建成事件；"
            "純觀點貼文不要建成會議。可建立每週一 08:00 UTC 的「週報整理」子循環。"
        ),
        channel_name="intel-semiconductor",
        messages=[
            SeedMessage(
                "商務部將於 2026-08-03 15:00 UTC 舉行出口管制簡報會（線上）。",
                sender="Wire-Bot",
                offset_hours=1,
            ),
            SeedMessage(
                "有人覺得管制太嚴了，市場會崩？（意見貼，勿建成會議）",
                sender="隨機網友",
                offset_hours=2,
            ),
            SeedMessage(
                "請固定每週一 08:00 UTC 做一小時「半導體週報整理」。",
                sender="主編",
                offset_hours=3,
            ),
        ],
        tick_by_default=False,
    ),
    Scenario(
        id="ple-empty",
        domain="reconcile",
        name="[PLE] 空訊息 skip（不喚醒 LLM）",
        prompt=("此情境驗證：游標已到最新時排程應跳過 LLM。不應為空佇列花費 token。"),
        channel_name="reconcile-quiet",
        messages=[
            SeedMessage(
                "（歷史訊息，游標已過）舊公告：忽略。",
                sender="System",
                offset_hours=1,
            ),
        ],
        seed_events=[
            SeedEvent(
                title="專案回顧草稿",
                start_time="2026-08-01T16:00:00Z",
                end_time="2026-08-01T17:00:00Z",
                body="應保留或轉為子循環",
            ),
        ],
        seed_children=[
            SeedChild(
                name="專案回顧（舊版，可能需調整）",
                rrule="FREQ=WEEKLY;BYDAY=FR",
                event_start_time="15:00",
            ),
        ],
        advance_cursor_to_end=True,
        tick_by_default=False,
    ),
    Scenario(
        id="ple-noise",
        domain="noise",
        name="[PLE] 雜訊無關訊息",
        prompt=(
            "本專案只管理「辦公室空調維修」相關排程。"
            "來源頻道常有無關閒聊／表情包／購物連結——必須忽略，不要建成會議。"
            "僅當訊息明確提到維修到場時間時才建立事件。"
        ),
        channel_name="office-random",
        messages=[
            SeedMessage("哈哈哈 😂😂😂", sender="同事A", offset_hours=1),
            SeedMessage(
                "誰要團購咖啡？連結 https://example.com/coffee",
                sender="同事B",
                offset_hours=2,
            ),
            SeedMessage(
                "今天天氣真好，週末去哪玩？",
                sender="同事C",
                offset_hours=3,
            ),
            SeedMessage(
                "（唯一有效）空調維修師傅約 2026-07-28 03:00 UTC 到場，約兩小時。",
                sender="總務",
                offset_hours=4,
            ),
        ],
        tick_by_default=True,
    ),
]

SCENARIO_BY_ID = {s.id: s for s in SCENARIOS}


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def resolve_db_path(cli_path: str | None) -> Path:
    if cli_path:
        return Path(cli_path).expanduser().resolve()
    env = os.environ.get(DB_PATH_ENV, "").strip()
    if env:
        return Path(env).expanduser().resolve()
    ensure_data_dir()
    return default_db_path().resolve()


async def _delete_task_cascade(db: Database, task_id: str) -> None:
    """Remove a prior eval task and owned rows (children cascade via FK)."""
    platform_id = f"ple-chan-{task_id}"
    await db.execute(
        "DELETE FROM messages WHERE platform = ? AND platform_id = ?",
        ("http", platform_id),
    )
    await db.execute("DELETE FROM user_events WHERE task_id = ?", (task_id,))
    await db.execute("DELETE FROM analysis_batches WHERE task_id = ?", (task_id,))
    await db.execute("DELETE FROM project_message_cursors WHERE task_id = ?", (task_id,))
    # Child recurring first (FK), then parent.
    await db.execute("DELETE FROM analysis_tasks WHERE parent_task_id = ?", (task_id,))
    await db.execute("DELETE FROM task_channels WHERE task_id = ?", (task_id,))
    await db.execute("DELETE FROM analysis_tasks WHERE id = ?", (task_id,))


async def _count_events(db: Database, task_id: str) -> int:
    row = await db.fetch_one(
        "SELECT COUNT(*) AS n FROM user_events WHERE task_id = ?",
        (task_id,),
    )
    return int(row["n"]) if row else 0


async def _list_events(db: Database, task_id: str) -> list[dict[str, Any]]:
    rows = await db.fetch_all(
        "SELECT id, title, start_time, end_time, origin, location, body "
        "FROM user_events WHERE task_id = ? ORDER BY start_time ASC",
        (task_id,),
    )
    return [dict(r) for r in rows]


async def _list_children(db: Database, task_id: str) -> list[dict[str, Any]]:
    rows = await db.fetch_all(
        "SELECT id, name, rrule, is_active, event_start_time, event_is_all_day "
        "FROM analysis_tasks WHERE parent_task_id = ? AND analysis_mode = 'recurring' "
        "ORDER BY created_at ASC",
        (task_id,),
    )
    return [dict(r) for r in rows]


async def _latest_batch(db: Database, task_id: str) -> dict[str, Any] | None:
    row = await db.fetch_one(
        "SELECT id, status, message_count, error_message, created_at, completed_at "
        "FROM analysis_batches WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
        (task_id,),
    )
    return dict(row) if row else None


async def _get_cursor(db: Database, task_id: str) -> str | None:
    from server.queries.project_tick_queries import load_project_message_cursor

    cursor = await load_project_message_cursor(db, task_id)
    return cursor.timestamp if cursor else None


async def _foreign_writes(db: Database, task_id: str, eval_ids: set[str]) -> dict[str, Any]:
    """Heuristic: events/children pointing at other non-eval tasks created recently? Skip.

    Instead check that all events for *this* task have correct task_id (tautology)
    and that no child of this project has wrong parent. Also flag events with empty title.
    """
    empty_title = await db.fetch_all(
        "SELECT id, title FROM user_events WHERE task_id = ? AND TRIM(COALESCE(title,'')) = ''",
        (task_id,),
    )
    wrong_parent = await db.fetch_all(
        "SELECT id, parent_task_id FROM analysis_tasks WHERE parent_task_id = ? AND analysis_mode != 'recurring'",
        (task_id,),
    )
    # Orphan check: did we somehow write events with NULL task while claiming ownership?
    # Not detectable easily; focus on empty titles + cross-task pollution among eval ids.
    other_eval_events = []
    for other in eval_ids:
        if other == task_id:
            continue
        # no-op placeholder — cross contamination would be events on OTHER tasks
        # that mention our channel; skip heavy scan.
        _ = other
    return {
        "emptyTitleEvents": [dict(r) for r in empty_title],
        "nonRecurringChildren": [dict(r) for r in wrong_parent],
        "crossEvalNote": other_eval_events,
    }


async def seed_scenario(db: Database, scenario: Scenario, *, base_ts: str) -> dict[str, Any]:
    """Insert/replace one project fixture. Returns seed metadata."""
    await _delete_task_cascade(db, scenario.id)
    now = utc_now_iso()
    platform, platform_id = "http", f"ple-chan-{scenario.id}"

    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await insert_analysis_task(
            tx,
            task_id=scenario.id,
            name=scenario.name,
            description=f"project_live_eval domain={scenario.domain}",
            prompt_template=scenario.prompt,
            analysis_mode="project",
            analysis_time_range="all",
            schedule_type="hourly",
            schedule_value=None,
            rrule=None,
            event_start_time=None,
            event_end_time=None,
            event_is_all_day=0,
            event_location=None,
            event_description=None,
            now=now,
        )
        await replace_task_channels(tx, scenario.id, [(platform, platform_id)])
        await upsert_channel(
            tx,
            platform,
            platform_id,
            channel_name=scenario.channel_name,
            refresh_name=True,
        )

        for i, child in enumerate(scenario.seed_children, start=1):
            child_id = f"{scenario.id}-child-{i}"
            await insert_analysis_task(
                tx,
                task_id=child_id,
                name=child.name,
                description="pre-seeded child recurring",
                prompt_template="",
                analysis_mode="recurring",
                analysis_time_range="all",
                schedule_type="seconds_10",
                schedule_value=None,
                rrule=child.rrule,
                event_start_time=child.event_start_time,
                event_end_time=None,
                event_is_all_day=child.event_is_all_day,
                event_location=None,
                event_description=None,
                parent_task_id=scenario.id,
                now=now,
            )

    # Messages with increasing timestamps relative to base_ts day.
    # Use fixed ISO so ticks are reproducible: 2026-07-27T{10+offset}:00:00Z
    message_ids: list[str] = []
    last_ts = ""
    last_mid = ""
    for i, msg in enumerate(scenario.messages, start=1):
        hour = 10 + msg.offset_hours
        ts = f"2026-07-27T{hour:02d}:00:00+00:00"
        mid = new_id()
        message_ids.append(mid)
        await db.execute(
            "INSERT INTO messages (id, platform, platform_id, platform_message_id, "
            "sender_name, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                mid,
                platform,
                platform_id,
                f"{scenario.id}-m{i}",
                msg.sender,
                msg.content,
                ts,
                now,
            ),
        )
        last_ts = ts
        last_mid = mid

    for ev in scenario.seed_events:
        await create_user_event(
            db,
            title=ev.title,
            start_time=ev.start_time,
            end_time=ev.end_time,
            body=ev.body,
            location=ev.location,
            origin="manual",
            task_id=scenario.id,
        )

    if scenario.advance_cursor_to_end and last_ts:
        await store_project_message_cursor(
            db,
            scenario.id,
            last_ts,
            message_id=last_mid or None,
        )

    return {
        "taskId": scenario.id,
        "domain": scenario.domain,
        "platform": platform,
        "platformId": platform_id,
        "channelName": scenario.channel_name,
        "messageCount": len(scenario.messages),
        "messageIds": message_ids,
        "seedEventCount": len(scenario.seed_events),
        "seedChildCount": len(scenario.seed_children),
        "cursorAdvanced": bool(scenario.advance_cursor_to_end and last_ts),
        "baseTs": base_ts,
    }


# ---------------------------------------------------------------------------
# Probe + tick
# ---------------------------------------------------------------------------


async def probe_agent_llm(db: Database) -> dict[str, Any]:
    llm = await ConfigurableLlmClient.from_db_for_agent(db)
    try:
        health = await llm.health_check()
        completion = await llm.test_completion()
        return {
            "provider": llm.provider,
            "model": llm.model,
            "baseUrl": llm.base_url,
            "health": health,
            "testCompletion": completion,
            "ok": bool(health.get("status") == "ok" and completion.get("success")),
        }
    finally:
        await llm.close()


async def snapshot_project(db: Database, task_id: str) -> dict[str, Any]:
    return {
        "eventCount": await _count_events(db, task_id),
        "events": await _list_events(db, task_id),
        "children": await _list_children(db, task_id),
        "cursor": await _get_cursor(db, task_id),
        "batch": await _latest_batch(db, task_id),
    }


def _heuristic_flags(
    scenario: Scenario,
    before: dict[str, Any],
    after: dict[str, Any],
    tool_names: list[str],
) -> list[str]:
    flags: list[str] = []
    after_events = after.get("events") or []
    for ev in after_events:
        title = str(ev.get("title") or "").strip()
        if not title:
            flags.append(f"empty_title:{ev.get('id')}")
    # Noise scenario: many new events from jokes would be bad.
    if scenario.domain == "noise":
        delta = int(after["eventCount"]) - int(before["eventCount"])
        if delta > 2:
            flags.append(f"noise_overcreate:delta={delta}")
        # Titles that look like they came from chat spam
        for ev in after_events:
            t = str(ev.get("title") or "")
            if any(x in t for x in ("哈哈", "團購", "咖啡", "天氣", "週末")):
                flags.append(f"noise_spam_event:{t[:40]}")
    if scenario.domain == "reconcile":
        delta = int(after["eventCount"]) - int(before["eventCount"])
        if delta > 3:
            flags.append(f"reconcile_overcreate:delta={delta}")
    if not tool_names and scenario.domain not in ("reconcile", "noise"):
        # Soft signal — agent may finish with message-only if already satisfied
        flags.append("no_tool_calls_observed")
    return flags


async def run_tick_captured(
    db: Database,
    task_id: str,
) -> dict[str, Any]:
    """Call execute_project_tick while capturing AgentRuntime.chat result."""
    from server.agent.runtime import AgentRuntime

    captured: dict[str, Any] = {}
    original_chat = AgentRuntime.chat

    async def _wrapped(self: Any, *args: Any, **kwargs: Any) -> Any:
        result = await original_chat(self, *args, **kwargs)
        captured["result"] = result
        return result

    t0 = time.perf_counter()
    with patch.object(AgentRuntime, "chat", _wrapped):
        await execute_project_tick(
            db=db,
            broadcaster=SseBroadcaster(),
            task_id=task_id,
            analysis_paused=False,
        )
    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    result = captured.get("result") or {}
    tool_calls = result.get("toolCalls") or result.get("tool_calls") or []
    tool_names: list[str] = []
    for call in tool_calls:
        if isinstance(call, dict):
            name = call.get("name") or call.get("tool") or ""
            if name:
                tool_names.append(str(name))
    return {
        "elapsedMs": elapsed_ms,
        "agentMessage": (result.get("message") or "")[:500] if result else "",
        "toolCalls": tool_calls if isinstance(tool_calls, list) else [],
        "toolNames": tool_names,
        "toolCallCount": len(tool_names),
    }


# ---------------------------------------------------------------------------
# Rubric (filled after ticks; also emitted in JSON for the report step)
# ---------------------------------------------------------------------------


def score_scenario(
    scenario: Scenario,
    *,
    tick_ran: bool,
    tick_ok: bool,
    before: dict[str, Any],
    after: dict[str, Any],
    tool_names: list[str],
    flags: list[str],
    foreign: dict[str, Any],
) -> dict[str, Any]:
    """1–5 scores for dimensions; only meaningful when tick_ran."""
    if not tick_ran:
        return {
            "可用性": None,
            "歸屬正確": None,
            "領域適配": None,
            "克制": None,
            "可觀測": None,
            "notes": "seed-only (no real tick)",
        }

    # 可用性
    batch = after.get("batch") or {}
    batch_ok = batch.get("status") == "completed" and not batch.get("error_message")
    avail = 5 if tick_ok and batch_ok else (2 if batch.get("status") == "completed" else 1)

    # 歸屬正確
    ownership = 5
    if foreign.get("emptyTitleEvents"):
        ownership -= 1
    if foreign.get("nonRecurringChildren"):
        ownership -= 2
    # All listed events should have come from our task snapshot (by query)
    ownership = max(1, ownership)

    # 領域適配 — did something sensible happen for action-heavy domains?
    delta_events = int(after["eventCount"]) - int(before["eventCount"])
    children_after = after.get("children") or []
    children_before = before.get("children") or []
    delta_children = len(children_after) - len(children_before)
    if scenario.domain in ("engineering", "healthcare_ops", "life", "education", "marketing", "intel_media"):
        if delta_events > 0 or delta_children > 0 or tool_names:
            domain_fit = 4 if (delta_events + delta_children) >= 1 else 3
            if delta_events + delta_children >= 2:
                domain_fit = 5
        else:
            domain_fit = 2
    elif scenario.domain == "reconcile":
        domain_fit = 4 if tick_ok else 2
    else:
        domain_fit = 4 if tick_ok else 2

    # 克制
    restraint = 5
    bad_flags = [f for f in flags if f.startswith("noise_") or f.startswith("reconcile_over")]
    if bad_flags:
        restraint = max(1, 5 - 2 * len(bad_flags))
    elif scenario.domain == "noise" and delta_events <= 1:
        restraint = 5
    elif "no_tool_calls_observed" in flags and scenario.domain == "noise":
        restraint = 4  # may have created only the HVAC event via tools — ok either way

    # 可觀測
    observable = 5 if batch_ok and after.get("batch") else 3
    if after.get("cursor") != before.get("cursor") and scenario.messages and not scenario.advance_cursor_to_end:
        observable = 5
    elif scenario.advance_cursor_to_end:
        observable = 5 if batch_ok else 2

    return {
        "可用性": avail,
        "歸屬正確": ownership,
        "領域適配": domain_fit,
        "克制": restraint,
        "可觀測": observable,
        "notes": "; ".join(flags) if flags else "ok",
        "deltas": {
            "events": delta_events,
            "children": delta_children,
            "cursorAdvanced": before.get("cursor") != after.get("cursor"),
        },
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Live project_tick multi-domain eval harness")
    p.add_argument(
        "--db",
        default=None,
        help="SQLite path (default: INTELLIGENCE_MONITOR_DB or product DATA_DIR db)",
    )
    p.add_argument(
        "--all-ticks",
        action="store_true",
        help="Run real LLM ticks on every seeded scenario (default: hybrid 3–4)",
    )
    p.add_argument(
        "--tick",
        action="append",
        dest="tick_ids",
        default=None,
        help="Scenario id to tick (repeatable). Default hybrid set if omitted.",
    )
    p.add_argument("--no-seed", action="store_true", help="Skip seeding (tick existing ids only)")
    p.add_argument("--skip-probe", action="store_true", help="Skip agent LLM probe")
    p.add_argument("--dry-run", action="store_true", help="Seed + snapshot only; no LLM ticks")
    p.add_argument(
        "--output",
        default=str(_ROOT_DIR / "reports" / "project_live_eval.json"),
        help="JSON report path",
    )
    p.add_argument("--json-stdout", action="store_true", help="Also print full JSON to stdout")
    return p.parse_args(argv)


async def async_main(args: argparse.Namespace) -> int:
    db_path = resolve_db_path(args.db)
    print(f"[project_live_eval] db={db_path}")
    if not db_path.exists():
        print(f"ERROR: database not found: {db_path}", file=sys.stderr)
        return 2

    db = Database(str(db_path))
    await db.connect()
    await db.ensure_schema()

    report: dict[str, Any] = {
        "meta": {
            "db": str(db_path),
            "startedAt": utc_now_iso(),
            "hybridDefaultTickIds": list(DEFAULT_TICK_IDS),
            "allTicks": bool(args.all_ticks),
            "dryRun": bool(args.dry_run),
            "reminder": "評測資料未自動清除；請之後用 reset_local_databases.py --apply 或 Settings 完全重置。",
        },
        "probe": None,
        "scenarios": [],
        "rubric": {},
        "conclusion": None,
    }

    try:
        # Probe
        if args.skip_probe:
            report["probe"] = {"skipped": True, "ok": True}
            print("[probe] skipped")
        else:
            print("[probe] agent LLM via from_db_for_agent …")
            probe = await probe_agent_llm(db)
            report["probe"] = probe
            print(
                f"[probe] provider={probe.get('provider')} model={probe.get('model')} "
                f"ok={probe.get('ok')} health={probe.get('health', {}).get('status')} "
                f"test={probe.get('testCompletion', {}).get('success')}"
            )
            if not probe.get("ok") and not args.dry_run:
                err = (probe.get("testCompletion") or {}).get("error") or (probe.get("health") or {}).get("error")
                print(f"ERROR: agent LLM not ready: {err}", file=sys.stderr)
                report["conclusion"] = {
                    "blocked": True,
                    "reason": f"agent LLM probe failed: {err}",
                }
                _write_report(args.output, report)
                return 3

        # Decide which scenarios to tick
        if args.dry_run:
            tick_ids: list[str] = []
        elif args.all_ticks:
            tick_ids = [s.id for s in SCENARIOS]
        elif args.tick_ids:
            tick_ids = list(args.tick_ids)
        else:
            tick_ids = [s.id for s in SCENARIOS if s.tick_by_default]
            # Ensure DEFAULT_TICK_IDS order preference
            ordered = [i for i in DEFAULT_TICK_IDS if i in tick_ids]
            extras = [i for i in tick_ids if i not in ordered]
            tick_ids = ordered + extras

        unknown = [i for i in tick_ids if i not in SCENARIO_BY_ID]
        if unknown:
            print(f"ERROR: unknown scenario ids: {unknown}", file=sys.stderr)
            return 2

        print(f"[plan] seed_all={not args.no_seed} tick_ids={tick_ids}")

        base_ts = utc_now_iso()
        eval_ids = {s.id for s in SCENARIOS}

        # Seed all domains
        seed_meta_by_id: dict[str, Any] = {}
        if not args.no_seed:
            for scenario in SCENARIOS:
                meta = await seed_scenario(db, scenario, base_ts=base_ts)
                seed_meta_by_id[scenario.id] = meta
                print(
                    f"[seed] {scenario.id} domain={scenario.domain} "
                    f"msgs={meta['messageCount']} events={meta['seedEventCount']} "
                    f"children={meta['seedChildCount']}"
                )
        else:
            for scenario in SCENARIOS:
                seed_meta_by_id[scenario.id] = {"taskId": scenario.id, "skippedSeed": True}

        # Run ticks
        for scenario in SCENARIOS:
            entry: dict[str, Any] = {
                "id": scenario.id,
                "domain": scenario.domain,
                "name": scenario.name,
                "seed": seed_meta_by_id.get(scenario.id),
                "tick": None,
                "before": None,
                "after": None,
                "scores": None,
            }
            before = await snapshot_project(db, scenario.id)
            entry["before"] = {
                "eventCount": before["eventCount"],
                "childCount": len(before["children"]),
                "cursor": before["cursor"],
                "batch": before["batch"],
                "events": before["events"],
                "children": before["children"],
            }

            if scenario.id not in tick_ids:
                entry["scores"] = score_scenario(
                    scenario,
                    tick_ran=False,
                    tick_ok=False,
                    before=before,
                    after=before,
                    tool_names=[],
                    flags=[],
                    foreign={},
                )
                report["scenarios"].append(entry)
                continue

            print(f"[tick] {scenario.id} ({scenario.domain}) …")
            tick_err: str | None = None
            tick_payload: dict[str, Any] = {}
            try:
                tick_payload = await run_tick_captured(db, scenario.id)
            except Exception as exc:  # noqa: BLE001
                tick_err = f"{type(exc).__name__}: {exc}"
                traceback.print_exc()

            after = await snapshot_project(db, scenario.id)
            foreign = await _foreign_writes(db, scenario.id, eval_ids)
            tool_names = list(tick_payload.get("toolNames") or [])
            flags = _heuristic_flags(scenario, before, after, tool_names)
            batch = after.get("batch") or {}
            tick_ok = tick_err is None and batch.get("status") == "completed" and not batch.get("error_message")
            entry["tick"] = {
                **tick_payload,
                "ok": tick_ok,
                "error": tick_err or batch.get("error_message"),
            }
            entry["after"] = {
                "eventCount": after["eventCount"],
                "childCount": len(after["children"]),
                "cursor": after["cursor"],
                "batch": after["batch"],
                "events": after["events"],
                "children": after["children"],
                "foreign": foreign,
                "flags": flags,
            }
            entry["scores"] = score_scenario(
                scenario,
                tick_ran=True,
                tick_ok=bool(tick_ok),
                before=before,
                after=after,
                tool_names=tool_names,
                flags=flags,
                foreign=foreign,
            )
            report["scenarios"].append(entry)
            print(
                f"[tick] {scenario.id} ok={tick_ok} "
                f"tools={tool_names} "
                f"events {before['eventCount']}→{after['eventCount']} "
                f"children {len(before['children'])}→{len(after['children'])} "
                f"cursor {before['cursor']!r}→{after['cursor']!r} "
                f"{tick_payload.get('elapsedMs')}ms"
            )
            if batch.get("error_message"):
                err_msg = batch.get("error_message") or ""
                print(f"       batch_error={err_msg[:200]}")

        # Aggregate rubric for ticked scenarios
        ticked = [s for s in report["scenarios"] if s.get("tick") is not None]
        dims = ["可用性", "歸屬正確", "領域適配", "克制", "可觀測"]
        avg: dict[str, float | None] = {}
        for d in dims:
            vals = [s["scores"][d] for s in ticked if s.get("scores") and s["scores"].get(d) is not None]
            avg[d] = round(sum(vals) / len(vals), 2) if vals else None
        report["rubric"] = {
            "perScenario": {s["id"]: s["scores"] for s in report["scenarios"]},
            "averageTicked": avg,
            "tickedIds": [s["id"] for s in ticked],
            "seedOnlyIds": [s["id"] for s in report["scenarios"] if s.get("tick") is None],
        }

        report["conclusion"] = _build_conclusion(report)
        report["meta"]["finishedAt"] = utc_now_iso()

        _write_report(args.output, report)
        _print_summary(report)
        if args.json_stdout:
            print(json.dumps(report, ensure_ascii=False, indent=2))

        if report["conclusion"].get("blocked"):
            return 3
        # Soft failure if any tick hard-failed
        if any(s.get("tick") and not s["tick"].get("ok") for s in report["scenarios"]):
            return 1
        return 0
    finally:
        await db.close()


def _build_conclusion(report: dict[str, Any]) -> dict[str, Any]:
    avg = (report.get("rubric") or {}).get("averageTicked") or {}
    ticked = (report.get("rubric") or {}).get("tickedIds") or []
    if not ticked:
        return {
            "blocked": False,
            "verdict": "seed_only",
            "zh": "僅完成種子／dry-run，未跑真實 LLM tick，無法給出閉環效果結論。",
        }

    scores = [v for v in avg.values() if isinstance(v, (int, float))]
    mean = sum(scores) / len(scores) if scores else 0
    failed = [s["id"] for s in report["scenarios"] if s.get("tick") and not s["tick"].get("ok")]
    noise = next((s for s in report["scenarios"] if s["id"] == "ple-noise"), None)
    restraint = (noise or {}).get("scores", {}).get("克制") if noise else None

    if failed:
        verdict = "fragile"
        zh = (
            f"真實 tick 有失敗（{', '.join(failed)}）。架構閉環可跑通種子與 batch，"
            f"但實戰仍高度依賴模型／連線穩定性。平均分約 {mean:.1f}/5。"
        )
    elif mean >= 4.0 and (restraint is None or restraint >= 4):
        verdict = "usable_clean_arch"
        tick_list = ", ".join(ticked)
        restraint_zh = "佳" if restraint and restraint >= 4 else "未測"
        zh = (
            f"跨領域（{tick_list}）真實 tick 大致可用：batch 完成、歸屬正確、"
            f"詳情頁／DB 可觀測；雜訊克制={restraint_zh}。"
            f"結論：夠用且架構乾淨，但產出品質仍依賴 agent LLM／prompt（非保證優秀）。"
            f"平均 {mean:.1f}/5。"
        )
    elif mean >= 3.0:
        verdict = "usable_model_dependent"
        zh = (
            f"閉環可跑、多領域有產出，但分數中等（平均 {mean:.1f}/5）。"
            f"實戰效果仍明顯依賴模型與 prompt，建議人工抽查詳情頁後再定案。"
        )
    else:
        verdict = "not_ready"
        zh = f"真實 tick 平均偏低（{mean:.1f}/5）。工具閉環或模型行為不足，不宜視為可交付的專案管理模式。"

    return {
        "blocked": False,
        "verdict": verdict,
        "meanScore": round(mean, 2),
        "zh": zh,
        "failedTicks": failed,
        "dbWipedByScript": False,
    }


def _write_report(path: str, report: dict[str, Any]) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[report] wrote {out}")


def _print_summary(report: dict[str, Any]) -> None:
    print("\n======== Project Live Eval Summary ========")
    probe = report.get("probe") or {}
    print(f"LLM probe ok: {probe.get('ok')} ({probe.get('provider')}/{probe.get('model')})")
    rubric = report.get("rubric") or {}
    print(f"Ticked: {rubric.get('tickedIds')}")
    print(f"Seed-only: {rubric.get('seedOnlyIds')}")
    avg = rubric.get("averageTicked") or {}
    for k, v in avg.items():
        print(f"  {k}: {v}")
    conclusion = report.get("conclusion") or {}
    print(f"Verdict: {conclusion.get('verdict')}")
    print(f"結論: {conclusion.get('zh')}")
    print("DB was NOT wiped by this script.")
    print("===========================================\n")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    return asyncio.run(async_main(args))


if __name__ == "__main__":
    raise SystemExit(main())
