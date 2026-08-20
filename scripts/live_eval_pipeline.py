"""Live pipeline eval: real Telegram + Gemini + Serper, no fake seed rows.

Environment:
  VERIFY_BASE / DESKTOP_VERIFY_BASE — API base (default http://127.0.0.1:18820)
  VERIFY_BEARER / IM_ACCESS_TOKEN — full-scope (*) API key from 帳戶

Usage:
  uv run python scripts/live_eval_pipeline.py              # full loop
  uv run python scripts/live_eval_pipeline.py --apply
  uv run python scripts/live_eval_pipeline.py --wait
  uv run python scripts/live_eval_pipeline.py --items
  uv run python scripts/live_eval_pipeline.py --deactivate
  uv run python scripts/live_eval_pipeline.py --serper-only
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
_ROOT = _SCRIPT_DIR.parent
for _path in (_ROOT, _SCRIPT_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from _verify_common import (  # noqa: E402
    BASE,
    VERIFY_BEARER,
    api,
    configure_stdout,
)

configure_stdout()

TASK_PREFIX = "[live-eval]"
SERPER_TASK_PREFIX = "[live-eval-serper]"
RRULE = "FREQ=SECONDLY;INTERVAL=30"
SERPER_RRULE = "FREQ=SECONDLY;INTERVAL=10"
THRESHOLD = 1
SAMPLE_MIN = 3
SAMPLE_MAX = 5
WAIT_SECONDS = 120
SERPER_WAIT_SECONDS = 300
POLL_EVERY = 20
CHAT_TIMEOUT = 240
STATE_PATH = _SCRIPT_DIR / ".live_eval_state.json"
SERPER_PROMPT = (
    "先對本批訊息裡最值得核實的 1–2 個主題呼叫 web.search；"
    "沒有成功的 web.search 就不得輸出最終 JSON 事件。"
    "摘要不夠再用 web.fetch 讀 1 個具體 URL。"
    "不要只複述 Telegram 正文充當搜尋。"
)

MISSING_BEARER_ZH = (
    "前置檢查停止：沒有 IM_ACCESS_TOKEN / VERIFY_BEARER。\n"
    "請到「帳戶」頁建立一把範圍為 * 的 API key，然後在執行環境設定其一：\n"
    "  $env:IM_ACCESS_TOKEN = \"<token>\"\n"
    "  $env:VERIFY_BEARER = \"<token>\"\n"
    "本腳本不會代你登入、也不會改現有登入狀態。"
)

SERVER_DOWN_ZH = (
    f"伺服器連不上 {BASE}。請先在本機跑 `npm run dev`（API 預設 http://127.0.0.1:18820）。"
)


# ---------------------------------------------------------------------------
# HTTP / state
# ---------------------------------------------------------------------------


def _die(message: str, code: int = 2) -> None:
    reconfigure = getattr(sys.stderr, "reconfigure", None)
    if callable(reconfigure):
        reconfigure(encoding="utf-8", errors="replace")
    print(message, file=sys.stderr)
    raise SystemExit(code)


def _load_state() -> dict[str, Any]:
    if not STATE_PATH.is_file():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _titles(rows: list[dict[str, Any]], *, key: str = "title", n: int = 3) -> list[str]:
    out: list[str] = []
    for row in rows:
        value = str(row.get(key) or row.get("topicName") or row.get("name") or "").strip()
        if value:
            out.append(value)
        if len(out) >= n:
            break
    return out


def _channel_id(row: dict[str, Any]) -> str:
    cid = str(row.get("id") or "").strip()
    if cid:
        return cid
    return f"{row.get('platform')}:{row.get('platformId')}"


def _channel_label(row: dict[str, Any]) -> str:
    return str(row.get("channelName") or row.get("sourceName") or row.get("id") or "?").strip()


def _msg_time(msg: dict[str, Any]) -> str:
    return str(msg.get("timestamp") or msg.get("createdAt") or "")


def _iso_now() -> datetime:
    return datetime.now(timezone.utc)


def _window_range() -> tuple[str, str]:
    now = _iso_now()
    start = (now - timedelta(days=14)).strftime("%Y-%m-%dT00:00:00Z")
    end = (now + timedelta(days=45)).strftime("%Y-%m-%dT23:59:59Z")
    return start, end


# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------


def preflight() -> dict[str, Any]:
    if not VERIFY_BEARER:
        _die(MISSING_BEARER_ZH)

    try:
        status, health = api("GET", "/api/v1/health", timeout=10)
    except urllib.error.URLError as exc:
        _die(f"{SERVER_DOWN_ZH}\n原因：{exc.reason}")

    if status != 200 or not isinstance(health, dict):
        _die(f"GET /api/v1/health 失敗 status={status} body={health!r}")

    stamp = health.get("schemaVersion")
    if stamp != 1:
        _die(f"schemaVersion 不是 1（實際 {stamp}）。本評估假設 stamp 1（第一個資料庫版本）。")

    print(f"[preflight] health ok stamp={stamp} version={health.get('version')} base={BASE}")

    status, tg_sources = api("GET", "/api/v1/sources/telegram")
    if status == 401:
        _die(MISSING_BEARER_ZH)
    if status != 200 or not isinstance(tg_sources, list):
        _die(f"GET /sources/telegram 失敗 status={status}")
    connected = [
        row
        for row in tg_sources
        if isinstance(row, dict) and str(row.get("status") or "").lower() == "connected"
    ]
    if not connected:
        names = [
            f"{row.get('name')}({row.get('status')})"
            for row in tg_sources
            if isinstance(row, dict)
        ]
        _die(f"Telegram 未登入／未 connected。現有來源：{names or '（空）'}")
    tg_names = [str(row.get("name") or row.get("id")) for row in connected]
    print(f"[preflight] telegram connected: {tg_names}")

    status, profiles = api("GET", "/api/v1/llm/profiles")
    if status != 200 or not isinstance(profiles, list):
        _die(f"GET /llm/profiles 失敗 status={status}")

    gemini: dict[str, Any] | None = None
    for row in profiles:
        if not isinstance(row, dict):
            continue
        provider = str(row.get("provider") or "")
        model = str(row.get("model") or "").strip()
        api_key = str(row.get("apiKey") or "").strip()
        name = str(row.get("name") or "").strip()
        if provider != "gemini_compatible":
            continue
        if not name or not model or not api_key:
            continue
        gemini = row
        break
    if gemini is None:
        _die("找不到第一個完整 Gemini 設定檔（provider=gemini_compatible、有 model 與 apiKey）。")

    profile_id = str(gemini["id"])
    search_provider = str(gemini.get("webSearchProvider") or "auto")
    serper_key = str(gemini.get("serperSearchApiKey") or "").strip()
    print(
        f"[preflight] llm profile id={profile_id} name={gemini.get('name')!r} "
        f"model={gemini.get('model')} webSearchProvider={search_provider} "
        f"webSearchEnabled={gemini.get('webSearchEnabled')} serperKey={'yes' if serper_key else 'no'}"
    )

    patched = False
    if search_provider == "auto":
        if not serper_key:
            _die("設定檔 webSearchProvider=auto，但沒有 Serper key；未改登入、也未臆造金鑰。")
        patch_body = {
            "name": gemini["name"],
            "provider": gemini["provider"],
            "baseUrl": gemini.get("baseUrl") or "",
            "model": gemini.get("model") or "",
            "thinkingEnabled": bool(gemini.get("thinkingEnabled")),
            "jsonMode": gemini.get("jsonMode") or "disabled",
            "webSearchEnabled": True,
            "webSearchProvider": "serper",
            "staffClasses": list(gemini.get("staffClasses") or []),
        }
        status, updated = api("PATCH", f"/api/v1/llm/profiles/{profile_id}", patch_body)
        if status != 200 or not isinstance(updated, dict):
            _die(f"PATCH profile → serper 失敗 status={status} body={updated!r}")
        search_provider = str(updated.get("webSearchProvider") or "serper")
        patched = True
        print(f"[preflight] patched webSearchProvider auto → {search_provider}")
    elif search_provider != "serper":
        print(f"[preflight] webSearchProvider={search_provider}（不是 auto，未改）")

    sampled = _sample_telegram_channels()
    print(
        "[preflight] sampled channels: "
        + ", ".join(f"{c['label']} ({c['id']})" for c in sampled)
    )

    state = {
        "profileId": profile_id,
        "profileName": gemini.get("name"),
        "provider": gemini.get("provider"),
        "model": gemini.get("model"),
        "webSearchProvider": search_provider,
        "webSearchPatched": patched,
        "telegramSources": tg_names,
        "sampledChannels": sampled,
        "createdAt": _iso_now().isoformat(),
    }
    _save_state(state)
    return state


def _sample_telegram_channels() -> list[dict[str, Any]]:
    status, channels = api("GET", "/api/v1/channels")
    if status != 200 or not isinstance(channels, list):
        _die(f"GET /channels 失敗 status={status}")

    telegram_rows = [
        row
        for row in channels
        if isinstance(row, dict) and str(row.get("platform") or "") == "telegram"
    ]
    if not telegram_rows:
        _die("沒有 telegram channel 可抽樣。")

    ranked: list[tuple[str, dict[str, Any], list[dict[str, Any]]]] = []
    for offset in range(0, len(telegram_rows), 80):
        chunk = telegram_rows[offset : offset + 80]
        keys = [_channel_id(row) for row in chunk]
        query = urllib.parse.urlencode({"channels": ",".join(keys), "limit": "5"})
        status, latest = api("GET", f"/api/v1/channels/latest-messages?{query}")
        if status != 200 or not isinstance(latest, dict):
            _die(f"GET /channels/latest-messages 失敗 status={status}")
        by_id = {_channel_id(row): row for row in chunk}
        for cid, messages in latest.items():
            msgs = [m for m in (messages or []) if isinstance(m, dict)]
            if not msgs:
                continue
            newest = max((_msg_time(m) for m in msgs), default="")
            row = by_id.get(str(cid)) or {"id": cid, "platform": "telegram"}
            ranked.append((newest, row, msgs))

    ranked.sort(key=lambda item: item[0], reverse=True)
    picked = ranked[:SAMPLE_MAX]
    if len(picked) < SAMPLE_MIN:
        _die(
            f"有訊息的 Telegram 對話不足 {SAMPLE_MIN} 個（實際 {len(picked)}）。"
            "請確認 collector 已拉到近期訊息。"
        )

    sampled: list[dict[str, Any]] = []
    for newest, row, msgs in picked:
        snippets = []
        for msg in msgs[:3]:
            text = str(msg.get("content") or "").replace("\n", " ").strip()
            snippets.append(
                {
                    "id": msg.get("id"),
                    "time": _msg_time(msg),
                    "sender": msg.get("senderName"),
                    "text": text[:280],
                }
            )
        sampled.append(
            {
                "id": _channel_id(row),
                "label": _channel_label(row),
                "newest": newest,
                "snippets": snippets,
            }
        )
    return sampled


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


def _preset_prompt(templates: list[dict[str, Any]], preset_id: str) -> str:
    for row in templates:
        if row.get("id") == preset_id:
            return str(row.get("promptTemplate") or "").strip()
    _die(f"找不到任務模板 {preset_id}")
    raise AssertionError


def _task_channel_ids(state: dict[str, Any]) -> list[str]:
    return [str(c["id"]) for c in state.get("sampledChannels") or []]


def _upsert_task(name: str, body: dict[str, Any]) -> dict[str, Any]:
    status, tasks = api("GET", "/api/v1/tasks")
    if status != 200 or not isinstance(tasks, list):
        _die(f"GET /tasks 失敗 status={status}")
    existing = next((row for row in tasks if isinstance(row, dict) and row.get("name") == name), None)
    if existing:
        put_body = {**body, "isActive": True}
        status, payload = api("PUT", f"/api/v1/tasks/{existing['id']}", put_body)
        if status != 200 or not isinstance(payload, dict):
            _die(f"PUT {name} 失敗 status={status} body={payload!r}")
        print(f"[apply] updated {name} id={payload.get('id')} active={payload.get('isActive')}")
        return payload
    status, payload = api("POST", "/api/v1/tasks", {**body, "isActive": True})
    if status not in {200, 201} or not isinstance(payload, dict):
        _die(f"POST {name} 失敗 status={status} body={payload!r}")
    print(f"[apply] created {name} id={payload.get('id')}")
    return payload


def apply_tasks(state: dict[str, Any]) -> dict[str, Any]:
    status, templates = api("GET", "/api/v1/tasks/templates")
    if status != 200 or not isinstance(templates, list):
        _die(f"GET /tasks/templates 失敗 status={status}")

    channel_ids = _task_channel_ids(state)
    profile_id = state["profileId"]
    shared = {
        "channelIds": channel_ids,
        "llmProfileId": profile_id,
        "scheduleRrule": RRULE,
        "analysisTriggerThreshold": THRESHOLD,
        "worksetId": "__general__",
    }

    specs = [
        (
            "intel",
            f"{TASK_PREFIX} 關鍵情報摘要",
            {
                **shared,
                "name": f"{TASK_PREFIX} 關鍵情報摘要",
                "description": "live-eval intel_event key-insights",
                "promptTemplate": _preset_prompt(templates, "key-insights"),
                "analysisMode": "intel_event",
                "analysisTimeRange": "1d",
                "includeInTimeline": True,
                "outputAnalysisEvents": True,
                "emoji": "💡",
            },
        ),
        (
            "schedule",
            f"{TASK_PREFIX} 時間行程推理",
            {
                **shared,
                "name": f"{TASK_PREFIX} 時間行程推理",
                "description": "live-eval schedule-time-inference",
                "promptTemplate": _preset_prompt(templates, "schedule-time-inference"),
                "analysisMode": "intel_event",
                "analysisTimeRange": "7d",
                "includeInTimeline": True,
                "outputAnalysisEvents": True,
                "emoji": "🗓️",
            },
        ),
        (
            "leaderboard",
            f"{TASK_PREFIX} 排行榜",
            {
                **shared,
                "name": f"{TASK_PREFIX} 排行榜",
                "description": "live-eval leaderboard",
                "promptTemplate": "從抽樣對話提取目前最熱的主題、關鍵詞與討論焦點，輸出排行榜。忽略驗證碼與系統通知。",
                "analysisMode": "leaderboard",
                "analysisTimeRange": "1d",
                "includeInTimeline": False,
                "outputAnalysisEvents": False,
                "emoji": "🏆",
            },
        ),
        (
            "web_scout",
            f"{TASK_PREFIX} 網搜 Scout",
            {
                **shared,
                "name": f"{TASK_PREFIX} 網搜 Scout",
                "description": "live-eval agent web_scout",
                "promptTemplate": (
                    "根據抽樣對話裡可核實的線索做網搜偵察。"
                    "必須至少呼叫 web.search 一次（關鍵字來自訊息，可多輪調整）。"
                    "若 snippet 不夠再 web.fetch 1–2 個具體頁面，禁止整批抓取搜尋結果。"
                    "把有情報價值的發現寫成 analysis_events；證據不足可空 items。"
                    "不要編造搜尋結果中不存在的事實。"
                ),
                "analysisMode": "agent",
                "analysisTimeRange": "1d",
                "includeInTimeline": True,
                "triggerMode": "message_threshold",
                "capCalendarRead": True,
                "capCalendarWrites": False,
                "capWebSearch": True,
                "capForceWebSearch": True,
                "capReadAnalysisEvents": True,
                "capReadItems": True,
                "outputCalendar": False,
                "outputAnalysisEvents": True,
                "emoji": "🔎",
            },
        ),
        (
            "calendar",
            f"{TASK_PREFIX} 日曆寫入",
            {
                **shared,
                "name": f"{TASK_PREFIX} 日曆寫入",
                "description": "live-eval agent calendar write",
                "promptTemplate": (
                    "只把訊息裡明確可排程的行程／會議／截止日期寫進 user_events。"
                    "先讀現有日曆避免重複。沒有明確時間或只是閒聊就不要寫。"
                    "禁止灌垃圾、禁止把情報摘要當成行程、禁止 items.create。"
                    "寫完用一句話總結改動。"
                ),
                "analysisMode": "agent",
                "analysisTimeRange": "7d",
                "includeInTimeline": True,
                "triggerMode": "message_cursor",
                "capCalendarRead": True,
                "capCalendarWrites": True,
                "capWebSearch": False,
                "capForceWebSearch": False,
                "capReadAnalysisEvents": True,
                "capReadItems": True,
                "outputCalendar": True,
                "outputAnalysisEvents": False,
                "emoji": "📅",
            },
        ),
    ]

    created: dict[str, Any] = {}
    for key, name, body in specs:
        payload = _upsert_task(name, body)
        created[key] = {
            "id": payload["id"],
            "name": payload["name"],
            "analysisMode": payload.get("analysisMode"),
            "triggerMode": payload.get("triggerMode"),
            "isActive": payload.get("isActive"),
        }

    state["tasks"] = created
    _save_state(state)
    return created


def deactivate_live_eval_tasks(prefix: str = TASK_PREFIX) -> list[dict[str, Any]]:
    status, tasks = api("GET", "/api/v1/tasks")
    if status != 200 or not isinstance(tasks, list):
        _die(f"GET /tasks 失敗 status={status}")
    results: list[dict[str, Any]] = []
    for row in tasks:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "")
        if not name.startswith(prefix):
            continue
        task_id = str(row["id"])
        if row.get("isActive"):
            status, payload = api("PATCH", f"/api/v1/tasks/{task_id}/active")
            if status != 200 or not isinstance(payload, dict):
                print(f"[deactivate] FAIL {name} status={status} body={payload!r}")
                results.append({"id": task_id, "name": name, "ok": False, "isActive": row.get("isActive")})
                continue
            print(f"[deactivate] {name} id={task_id} isActive={payload.get('isActive')}")
            results.append({"id": task_id, "name": name, "ok": True, "isActive": payload.get("isActive")})
        else:
            print(f"[deactivate] already inactive {name} id={task_id}")
            results.append({"id": task_id, "name": name, "ok": True, "isActive": False})
    return results


# ---------------------------------------------------------------------------
# Wait / evaluate
# ---------------------------------------------------------------------------


def _events_for_task(task_id: str, limit: int = 30) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"taskId": task_id, "limit": str(limit), "sort": "analyzed_at"})
    status, body = api("GET", f"/api/v1/results/events?{query}")
    if status != 200 or not isinstance(body, dict):
        return []
    items = body.get("items") or []
    return [row for row in items if isinstance(row, dict)]


def _trending_for_task(task_id: str) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"taskId": task_id})
    status, body = api("GET", f"/api/v1/results/trending?{query}")
    if status != 200:
        return []
    if isinstance(body, list):
        return [row for row in body if isinstance(row, dict)]
    if isinstance(body, dict):
        return [row for row in (body.get("items") or []) if isinstance(row, dict)]
    return []


def _calendar_window() -> dict[str, list[dict[str, Any]]]:
    start, end = _window_range()
    query = urllib.parse.urlencode(
        {
            "start": start,
            "end": end,
            "includeAnalysis": "true",
            "includeUser": "true",
            "includeRecurring": "false",
            "includeItems": "false",
            "limit": "200",
        }
    )
    status, body = api("GET", f"/api/v1/calendar/window?{query}")
    empty: dict[str, list[dict[str, Any]]] = {"analysis": [], "user": []}
    if status != 200 or not isinstance(body, dict):
        return empty
    items = [row for row in (body.get("items") or []) if isinstance(row, dict)]
    return {
        "analysis": [row for row in items if row.get("source") == "analysis"],
        "user": [row for row in items if row.get("source") == "user"],
    }


def _agent_ticks(task_id: str) -> dict[str, Any]:
    status, body = api("GET", f"/api/v1/tasks/{task_id}/agent-ticks?limit=20")
    if status != 200 or not isinstance(body, dict):
        return {"status": status, "ticks": [], "error": body}
    return body


def _collect_eval(state: dict[str, Any]) -> dict[str, Any]:
    tasks = state.get("tasks") or {}
    status, queue = api("GET", "/api/v1/results/queue")
    intel_id = (tasks.get("intel") or {}).get("id")
    sched_id = (tasks.get("schedule") or {}).get("id")
    board_id = (tasks.get("leaderboard") or {}).get("id")
    scout_id = (tasks.get("web_scout") or {}).get("id")
    cal_id = (tasks.get("calendar") or {}).get("id")

    intel_events = _events_for_task(intel_id) if intel_id else []
    sched_events = _events_for_task(sched_id) if sched_id else []
    scout_events = _events_for_task(scout_id) if scout_id else []
    trending = _trending_for_task(board_id) if board_id else []
    window = _calendar_window()
    scout_ticks = _agent_ticks(scout_id) if scout_id else {"ticks": []}
    cal_ticks = _agent_ticks(cal_id) if cal_id else {"ticks": []}

    live_ids = {str(v.get("id")) for v in tasks.values() if v.get("id")}
    window_user = [
        row
        for row in window["user"]
        if str(row.get("taskId") or "") in live_ids or str(row.get("origin") or "") == "agent"
    ]
    window_analysis = [row for row in window["analysis"] if str(row.get("taskId") or "") in live_ids]

    return {
        "queue": queue if status == 200 else {"error": queue, "status": status},
        "intelEvents": intel_events,
        "scheduleEvents": sched_events,
        "scoutEvents": scout_events,
        "trending": trending,
        "windowAnalysis": window_analysis,
        "windowUser": window_user,
        "scoutTicks": scout_ticks,
        "calendarTicks": cal_ticks,
    }


def _tick_progress(eval_body: dict[str, Any]) -> tuple[int, int]:
    queue = eval_body.get("queue") or {}
    pending = int(queue.get("pendingCount") or 0)
    processing = len(queue.get("processingBatches") or [])
    attention = len(queue.get("attentionBatches") or [])
    produced = (
        len(eval_body.get("intelEvents") or [])
        + len(eval_body.get("scheduleEvents") or [])
        + len(eval_body.get("scoutEvents") or [])
        + len(eval_body.get("trending") or [])
        + len(eval_body.get("windowUser") or [])
    )
    scout_ticks = ((eval_body.get("scoutTicks") or {}).get("ticks")) or []
    cal_ticks = ((eval_body.get("calendarTicks") or {}).get("ticks")) or []
    tick_n = len(scout_ticks) + len(cal_ticks)
    return produced, pending + processing + attention + tick_n


def wait_and_eval(state: dict[str, Any], *, seconds: int = WAIT_SECONDS) -> dict[str, Any]:
    deadline = time.time() + max(30, seconds)
    eval_body: dict[str, Any] = {}
    round_i = 0
    while True:
        round_i += 1
        eval_body = _collect_eval(state)
        produced, activity = _tick_progress(eval_body)
        queue = eval_body.get("queue") or {}
        print(
            f"[wait] tick={round_i} produced={produced} activity={activity} "
            f"paused={queue.get('analysisPaused')} pending={queue.get('pendingCount')} "
            f"processing={len(queue.get('processingBatches') or [])} "
            f"attention={len(queue.get('attentionBatches') or [])}"
        )
        remaining = deadline - time.time()
        if remaining <= 0:
            break
        # If we already have intel+board+at least one agent tick, can stop a bit early.
        scout_ticks = ((eval_body.get("scoutTicks") or {}).get("ticks")) or []
        if produced >= 3 and scout_ticks and remaining < seconds * 0.4:
            break
        time.sleep(min(POLL_EVERY, max(5, remaining)))

    state["eval"] = {
        "intelCount": len(eval_body.get("intelEvents") or []),
        "scheduleCount": len(eval_body.get("scheduleEvents") or []),
        "scoutEventCount": len(eval_body.get("scoutEvents") or []),
        "trendingCount": len(eval_body.get("trending") or []),
        "windowAnalysisCount": len(eval_body.get("windowAnalysis") or []),
        "windowUserCount": len(eval_body.get("windowUser") or []),
    }
    _save_state(state)
    return eval_body


def _tool_evidence(ticks_payload: dict[str, Any]) -> dict[str, Any]:
    ticks = ticks_payload.get("ticks") or []
    names: list[str] = []
    summaries: list[str] = []
    errors: list[str] = []
    for tick in ticks:
        if not isinstance(tick, dict):
            continue
        if tick.get("errorMessage"):
            errors.append(str(tick.get("errorMessage")))
        for call in tick.get("toolCalls") or []:
            if not isinstance(call, dict):
                continue
            name = str(call.get("name") or "")
            names.append(name)
            summary = str(call.get("resultSummary") or "")
            if summary:
                summaries.append(f"{name}: {summary[:220]}")
    return {
        "tickCount": len(ticks),
        "outcomes": [t.get("outcome") for t in ticks if isinstance(t, dict)],
        "toolNames": names,
        "searches": names.count("web.search"),
        "fetches": names.count("web.fetch"),
        "summaries": summaries[:8],
        "errors": errors[:5],
        "inFlight": ticks_payload.get("inFlight"),
        "pendingSinceCursor": ticks_payload.get("pendingSinceCursor"),
    }


def _time_guess_notes(events: list[dict[str, Any]]) -> dict[str, Any]:
    with_time = [e for e in events if e.get("startTime")]
    without = [e for e in events if not e.get("startTime")]
    samples = []
    for event in events[:5]:
        samples.append(
            {
                "title": event.get("title"),
                "startTime": event.get("startTime"),
                "sourceMessageTime": event.get("sourceMessageTime"),
                "body": str(event.get("body") or "")[:160],
            }
        )
    return {
        "withTime": len(with_time),
        "withoutTime": len(without),
        "samples": samples,
    }


# ---------------------------------------------------------------------------
# Assistant items
# ---------------------------------------------------------------------------


def create_items_via_assistant(state: dict[str, Any]) -> dict[str, Any]:
    sampled = state.get("sampledChannels") or []
    lines = []
    for channel in sampled:
        lines.append(f"- {channel.get('label')} ({channel.get('id')})")
        for snip in channel.get("snippets") or []:
            text = str(snip.get("text") or "").strip()
            if text:
                lines.append(f"  · [{snip.get('time')}] {snip.get('sender') or ''}: {text}")
    digest = "\n".join(lines) if lines else "（無抽樣訊息）"
    prompt = (
        "請根據下列剛抽樣的 Telegram 對話，找出可追蹤的物品（票券、訂閱、檔期、物資、證件、優惠券等），"
        "呼叫 items.create 寫入工作集 `__general__`。\n"
        "規則：每類最多 3 筆、標題具體、不要重複、不要虛構沒在訊息裡出現的東西；"
        "沒有可寫的就不要硬建。寫完用中文簡短說明建了什麼。\n\n"
        f"{digest}"
    )
    body = {
        "messages": [{"role": "user", "content": prompt}],
        "worksetId": "__general__",
        "locale": "zh-Hant",
        "llmProfileId": state.get("profileId"),
        "sessionId": "live-eval-items",
    }
    print("[items] POST /api/v1/agent/chat …")
    status, payload = api("POST", "/api/v1/agent/chat", body, timeout=CHAT_TIMEOUT)
    if status != 200:
        print(f"[items] chat failed status={status} body={payload!r}")
        return {"status": status, "error": payload, "items": []}

    status_items, items = api("GET", "/api/v1/items?worksetId=__general__")
    item_rows = [row for row in items if isinstance(row, dict)] if status_items == 200 and isinstance(items, list) else []
    tool_calls = payload.get("toolCalls") if isinstance(payload, dict) else []
    created_calls = [
        call
        for call in (tool_calls or [])
        if isinstance(call, dict) and str(call.get("name") or "") == "items.create"
    ]
    return {
        "status": status,
        "message": (payload.get("message") if isinstance(payload, dict) else None),
        "toolCalls": tool_calls,
        "itemsCreateCalls": created_calls,
        "items": item_rows,
        "itemCount": len(item_rows),
    }


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


def print_report(
    state: dict[str, Any],
    eval_body: dict[str, Any] | None,
    items_result: dict[str, Any] | None,
    deactivated: list[dict[str, Any]] | None,
) -> None:
    tasks = state.get("tasks") or {}
    eval_body = eval_body or {}
    items_result = items_result or {}
    scout_ev = _tool_evidence(eval_body.get("scoutTicks") or {})
    cal_ev = _tool_evidence(eval_body.get("calendarTicks") or {})
    queue = eval_body.get("queue") or {}
    intel = eval_body.get("intelEvents") or []
    sched = eval_body.get("scheduleEvents") or []
    scout_events = eval_body.get("scoutEvents") or []
    trending = eval_body.get("trending") or []
    win_a = eval_body.get("windowAnalysis") or []
    win_u = eval_body.get("windowUser") or []
    time_notes = _time_guess_notes(sched or intel)

    print("\n========== live-eval 效果報告 ==========")
    print("【前置】")
    print(
        f"  設定檔 {state.get('profileId')} / {state.get('profileName')} "
        f"provider={state.get('provider')} model={state.get('model')} "
        f"webSearch={state.get('webSearchProvider')}"
        f"{'（已從 auto PATCH 成 serper）' if state.get('webSearchPatched') else ''}"
    )
    print(f"  Telegram：{', '.join(state.get('telegramSources') or [])}")
    print(
        "  抽樣對話："
        + ", ".join(f"{c.get('label')} ({c.get('id')})" for c in state.get("sampledChannels") or [])
    )

    print("【任務】")
    for key, row in tasks.items():
        print(f"  {key}: {row.get('id')}  {row.get('name')}  mode={row.get('analysisMode')}")

    print("【產出】")
    print(f"  隊列 paused={queue.get('analysisPaused')} pending={queue.get('pendingCount')} "
          f"processing={len(queue.get('processingBatches') or [])} "
          f"attention={len(queue.get('attentionBatches') or [])}")
    if queue.get("attentionBatches"):
        for batch in (queue.get("attentionBatches") or [])[:5]:
            print(f"    attention {batch.get('taskName')}: {batch.get('errorMessage') or batch.get('status')}")
    print(f"  情報事件 intel={len(intel)} 例：{_titles(intel) or '（空）'}")
    print(f"  行程推理 schedule={len(sched)} 例：{_titles(sched) or '（空）'}")
    print(f"  Scout 事件={len(scout_events)} 例：{_titles(scout_events) or '（空）'}")
    print(f"  排行榜={len(trending)} 例：{_titles(trending, key='topicName') or '（空）'}")
    print(f"  日曆 window analysis={len(win_a)} 例：{_titles(win_a) or '（空）'}")
    print(f"  日曆 window user/agent={len(win_u)} 例：{_titles(win_u) or '（空）'}")

    print("【時間質量】")
    print(
        f"  有 startTime={time_notes['withTime']} 無時間={time_notes['withoutTime']}"
    )
    for sample in time_notes["samples"][:3]:
        print(
            f"    · {sample.get('title')} start={sample.get('startTime')} "
            f"msgTime={sample.get('sourceMessageTime')}"
        )

    print("【搜尋 / fetch】")
    print(
        f"  Scout ticks={scout_ev['tickCount']} outcomes={scout_ev['outcomes']} "
        f"web.search={scout_ev['searches']} web.fetch={scout_ev['fetches']} "
        f"tools={scout_ev['toolNames']}"
    )
    if scout_ev["summaries"]:
        for line in scout_ev["summaries"][:4]:
            print(f"    {line}")
    if scout_ev["errors"]:
        print(f"  Scout 錯誤：{scout_ev['errors']}")
    native_hint = (
        "走 Serper 工具路徑（應出現 web.search，不該是 Gemini 原生搜尋）"
        if state.get("webSearchProvider") == "serper"
        else f"目前 provider={state.get('webSearchProvider')}"
    )
    print(f"  路由判定：{native_hint}")
    print(
        f"  日曆 Agent ticks={cal_ev['tickCount']} outcomes={cal_ev['outcomes']} "
        f"tools={cal_ev['toolNames']} pendingSinceCursor={cal_ev.get('pendingSinceCursor')}"
    )
    if cal_ev["errors"]:
        print(f"  日曆 Agent 錯誤：{cal_ev['errors']}")

    print("【物品】")
    if items_result.get("error"):
        print(f"  助理對話失敗 status={items_result.get('status')} {items_result.get('error')!r}")
    else:
        create_n = len(items_result.get("itemsCreateCalls") or [])
        print(f"  items.create 呼叫 {create_n} 次；GET /items 共 {items_result.get('itemCount')} 筆")
        print(f"  例：{_titles(items_result.get('items') or []) or '（空）'}")
        msg = str(items_result.get("message") or "").strip()
        if msg:
            print(f"  助理：{msg[:400]}")

    print("【缺口 / 錯誤】")
    gaps: list[str] = []
    if queue.get("analysisPaused"):
        gaps.append("analysis_paused=true，排程可能沒跑")
    if not intel:
        gaps.append("情報任務沒有 analysis_events")
    if not trending:
        gaps.append("排行榜沒有 trending_topics")
    if not scout_ev["tickCount"]:
        gaps.append("網搜 Scout 沒有 agent-ticks")
    elif scout_ev["searches"] == 0:
        gaps.append("Scout 有 tick 但沒呼叫 web.search（可能走原生或模型沒遵從）")
    if scout_ev["fetches"] == 0:
        gaps.append("沒有 web.fetch（snippet 可能已夠，或模型沒跟進）")
    if not win_u:
        gaps.append("日曆寫入沒有 user_events（可能訊息無可排程行程，屬預期）")
    if not (items_result.get("itemsCreateCalls") or []):
        gaps.append("助理未成功 items.create")
    for batch in queue.get("attentionBatches") or []:
        gaps.append(f"attention: {batch.get('taskName')} {batch.get('errorMessage')}")
    if not gaps:
        print("  無明顯缺口")
    else:
        for gap in gaps:
            print(f"  - {gap}")

    print("【收尾】")
    if deactivated is None:
        print("  （尚未停用）")
    elif not deactivated:
        print("  沒找到 [live-eval] 任務")
    else:
        for row in deactivated:
            print(f"  {row.get('name')} id={row.get('id')} isActive={row.get('isActive')}")
        if all(row.get("isActive") is False for row in deactivated):
            print("  全部 [live-eval] 任務已 isActive=false；資料列保留給 UI。")
    print("======================================\n")


def apply_serper_task(state: dict[str, Any]) -> dict[str, Any]:
    channel_ids = _task_channel_ids(state)
    name = f"{SERPER_TASK_PREFIX} 網搜 Scout"
    body = {
        "name": name,
        "description": "live-eval-serper agent web_scout (force web.search)",
        "promptTemplate": SERPER_PROMPT,
        "analysisMode": "agent",
        "analysisTimeRange": "1d",
        "channelIds": channel_ids,
        "llmProfileId": state["profileId"],
        "scheduleRrule": SERPER_RRULE,
        "analysisTriggerThreshold": THRESHOLD,
        "worksetId": "__general__",
        "includeInTimeline": True,
        "triggerMode": "message_threshold",
        "capCalendarRead": True,
        "capCalendarWrites": False,
        "capWebSearch": True,
        "capForceWebSearch": True,
        "capReadAnalysisEvents": True,
        "capReadItems": True,
        "outputCalendar": False,
        "outputAnalysisEvents": True,
        "emoji": "🔎",
        "isActive": True,
    }
    payload = _upsert_task(name, body)
    saved = {
        "id": payload.get("id"),
        "name": payload.get("name"),
        "analysisMode": payload.get("analysisMode"),
        "triggerMode": payload.get("triggerMode"),
        "scheduleRrule": payload.get("scheduleRrule"),
        "analysisTriggerThreshold": payload.get("analysisTriggerThreshold"),
        "capWebSearch": payload.get("capWebSearch"),
        "capForceWebSearch": payload.get("capForceWebSearch"),
        "outputAnalysisEvents": payload.get("outputAnalysisEvents"),
        "outputCalendar": payload.get("outputCalendar"),
        "isActive": payload.get("isActive"),
        "llmProfileId": payload.get("llmProfileId"),
        "channelIds": payload.get("channelIds") or channel_ids,
        "promptTemplate": str(payload.get("promptTemplate") or "")[:180],
    }
    print(
        f"[serper] saved task id={saved['id']} capWebSearch={saved['capWebSearch']} "
        f"capForceWebSearch={saved['capForceWebSearch']} trigger={saved['triggerMode']} "
        f"rrule={saved['scheduleRrule']} threshold={saved['analysisTriggerThreshold']}"
    )
    state.setdefault("tasks", {})
    state["tasks"]["web_scout_serper"] = saved
    _save_state(state)
    return saved


def _sse_collect(stop: threading.Event, sink: list[dict[str, Any]]) -> None:
    url = f"{BASE}/api/v1/events"
    headers = {"Accept": "text/event-stream"}
    if VERIFY_BEARER:
        headers["Authorization"] = f"Bearer {VERIFY_BEARER}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=SERPER_WAIT_SECONDS + 30) as resp:
            for raw in resp:
                if stop.is_set():
                    break
                line = raw.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                try:
                    envelope = json.loads(line[5:].strip())
                except json.JSONDecodeError:
                    continue
                if not isinstance(envelope, dict):
                    continue
                etype = envelope.get("type") or envelope.get("event")
                payload = envelope.get("payload") if isinstance(envelope.get("payload"), dict) else envelope
                if etype in {"analysis_started", "analysis_completed", "analysis_failed"}:
                    sink.append({"type": etype, "payload": payload})
    except Exception as exc:  # noqa: BLE001 — listener is best-effort evidence
        sink.append({"type": "sse_error", "payload": {"error": str(exc)}})


def _collect_app_logs(limit: int = 80) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"limit": str(limit)})
    status, body = api("GET", f"/api/v1/logs?{query}")
    if status != 200 or not isinstance(body, dict):
        return []
    rows = body.get("logs") or body.get("items") or []
    return [row for row in rows if isinstance(row, dict)]


def _log_mentions_search(rows: list[dict[str, Any]]) -> list[str]:
    needles = ("serper", "google.serper.dev", "web.search", "webSearch")
    hits: list[str] = []
    for row in rows:
        blob = json.dumps(row, ensure_ascii=False)
        if any(n.lower() in blob.lower() for n in needles):
            msg = str(row.get("message") or row.get("kind") or blob)[:220]
            hits.append(msg)
        if len(hits) >= 12:
            break
    return hits


def _web_mode_used_search(mode: str | None) -> bool:
    text = str(mode or "")
    return text.startswith("agent:") and "no_web_tool" not in text and text != "agent:off"


def wait_serper_eval(state: dict[str, Any], *, seconds: int = SERPER_WAIT_SECONDS) -> dict[str, Any]:
    task = (state.get("tasks") or {}).get("web_scout_serper") or {}
    task_id = str(task.get("id") or "")
    if not task_id:
        _die("沒有 serper 任務 id")

    sse_events: list[dict[str, Any]] = []
    stop = threading.Event()
    listener = threading.Thread(target=_sse_collect, args=(stop, sse_events), daemon=True)
    listener.start()

    deadline = time.time() + max(60, seconds)
    eval_body: dict[str, Any] = {}
    round_i = 0
    saw_success_search = False
    empty_tool_ticks = 0
    try:
        while True:
            round_i += 1
            ticks_payload = _agent_ticks(task_id)
            events = _events_for_task(task_id)
            evidence = _tool_evidence(ticks_payload)
            status_q, queue = api("GET", "/api/v1/results/queue")
            logs = _collect_app_logs()
            log_hits = _log_mentions_search(logs)
            our_sse = [
                item
                for item in sse_events
                if str((item.get("payload") or {}).get("taskId") or "") == task_id
                or item.get("type") == "sse_error"
            ]
            sse_modes = [
                str((item.get("payload") or {}).get("webSearchMode") or "")
                for item in our_sse
                if item.get("type") == "analysis_completed"
            ]
            sse_hit = any(_web_mode_used_search(mode) for mode in sse_modes)
            if evidence["searches"] > 0 or sse_hit:
                saw_success_search = True
            if evidence["tickCount"] and evidence["searches"] == 0:
                empty_tool_ticks = evidence["tickCount"]
            print(
                f"[serper-wait] tick={round_i} agentTicks={evidence['tickCount']} "
                f"outcomes={evidence['outcomes']} tools={evidence['toolNames']} "
                f"web.search={evidence['searches']} events={len(events)} "
                f"sseCompleted={sse_modes} logHits={len(log_hits)} "
                f"paused={(queue or {}).get('analysisPaused') if status_q == 200 else '?'}"
            )
            eval_body = {
                "queue": queue if status_q == 200 else {"error": queue, "status": status_q},
                "scoutEvents": events,
                "scoutTicks": ticks_payload,
                "sse": our_sse,
                "logHits": log_hits,
                "emptyToolTicks": empty_tool_ticks,
                "sawSuccessSearch": saw_success_search,
            }
            remaining = deadline - time.time()
            if remaining <= 0:
                break
            if saw_success_search and remaining < seconds * 0.35:
                break
            time.sleep(min(15, max(5, remaining)))
    finally:
        stop.set()

    state["eval"] = {
        "scoutEventCount": len(eval_body.get("scoutEvents") or []),
        "sawSuccessSearch": saw_success_search,
    }
    _save_state(state)
    return eval_body


def print_serper_report(
    state: dict[str, Any],
    eval_body: dict[str, Any],
    deactivated: list[dict[str, Any]] | None,
) -> None:
    task = (state.get("tasks") or {}).get("web_scout_serper") or {}
    scout_ev = _tool_evidence(eval_body.get("scoutTicks") or {})
    events = eval_body.get("scoutEvents") or []
    sse = eval_body.get("sse") or []
    sse_modes = [
        str((item.get("payload") or {}).get("webSearchMode") or "")
        for item in sse
        if item.get("type") == "analysis_completed"
    ]
    sse_started = [
        str((item.get("payload") or {}).get("webSearchMode") or "")
        for item in sse
        if item.get("type") == "analysis_started"
    ]
    persist_bug = (
        scout_ev["tickCount"] > 0
        and scout_ev["searches"] == 0
        and any(_web_mode_used_search(mode) for mode in sse_modes)
    )
    serper_ran = bool(
        scout_ev["searches"] > 0
        or any(_web_mode_used_search(mode) for mode in sse_modes)
        or eval_body.get("sawSuccessSearch")
    )
    print("\n========== live-eval-serper 報告 ==========")
    print(
        f"  profile={state.get('profileId')} model={state.get('model')} "
        f"webSearch={state.get('webSearchProvider')}"
        f"{'（已從 auto PATCH 成 serper）' if state.get('webSearchPatched') else ''}"
    )
    print(
        f"  task={task.get('id')} name={task.get('name')} "
        f"capWebSearch={task.get('capWebSearch')} capForceWebSearch={task.get('capForceWebSearch')} "
        f"trigger={task.get('triggerMode')} rrule={task.get('scheduleRrule')}"
    )
    print(f"  prompt={task.get('promptTemplate')}")
    print(
        f"  ticks={scout_ev['tickCount']} outcomes={scout_ev['outcomes']} "
        f"tools={scout_ev['toolNames']} web.search={scout_ev['searches']} "
        f"web.fetch={scout_ev['fetches']} errors={scout_ev['errors']}"
    )
    if scout_ev["summaries"]:
        for line in scout_ev["summaries"][:6]:
            print(f"    tool {line}")
    print(f"  SSE started modes={sse_started} completed modes={sse_modes}")
    print(f"  analysis_events={len(events)} 例：{_titles(events) or '（空）'}")
    for event in events[:2]:
        print(f"    · {event.get('title')} | {str(event.get('body') or '')[:160]}")
    if eval_body.get("logHits"):
        print(f"  log hits: {eval_body.get('logHits')}")
    else:
        print("  log hits: （無 serper / google.serper.dev / web.search）")
    print(f"  Serper 實際呼叫判定：{'是' if serper_ran else '否 / 未證實'}")
    if persist_bug:
        print(
            "  警告：ticks 已完成且 SSE 顯示有網搜，但 batch.tool_calls_json 沒有 web.search"
            "（persist 可能漏寫；Scout UI 會顯示空工具）。"
        )
    gaps: list[str] = []
    if not scout_ev["tickCount"]:
        gaps.append("沒有 completed agent-ticks")
    if scout_ev["tickCount"] and scout_ev["searches"] == 0 and not persist_bug:
        gaps.append("有 tick 但沒有 web.search（模型可能跳過工具，或 runtime 未注入）")
    if not events:
        gaps.append("沒有 analysis_events")
    if not serper_ran:
        gaps.append("無法證實 google.serper.dev / web.search 被呼叫")
    for gap in gaps:
        print(f"  缺口：{gap}")
    if deactivated:
        for row in deactivated:
            print(f"  停用 {row.get('name')} id={row.get('id')} isActive={row.get('isActive')}")
    print("==========================================\n")


def _require_state() -> dict[str, Any]:
    state = _load_state()
    if not state:
        _die("沒有 .live_eval_state.json，請先跑不帶旗標的完整流程或 --apply。")
    return state


def main() -> int:
    parser = argparse.ArgumentParser(description="Live pipeline eval (Telegram + Gemini + Serper)")
    parser.add_argument("--apply", action="store_true", help="只建/更新 [live-eval] 任務")
    parser.add_argument("--wait", action="store_true", help="只等待並讀取產出")
    parser.add_argument("--items", action="store_true", help="只跑助理 items.create")
    parser.add_argument("--deactivate", action="store_true", help="停用 [live-eval] 任務")
    parser.add_argument("--serper-only", action="store_true", help="只建並等待 [live-eval-serper] 網搜任務")
    parser.add_argument("--wait-seconds", type=int, default=None)
    args = parser.parse_args()
    flags = [args.apply, args.wait, args.items, args.deactivate, args.serper_only]
    full = not any(flags)

    if args.serper_only:
        wait_seconds = args.wait_seconds if args.wait_seconds is not None else SERPER_WAIT_SECONDS
        print("[serper-only] pausing competing [live-eval] tasks")
        deactivate_live_eval_tasks(TASK_PREFIX)
        state = preflight()
        apply_serper_task(state)
        eval_body = wait_serper_eval(state, seconds=wait_seconds)
        deactivated = deactivate_live_eval_tasks(SERPER_TASK_PREFIX)
        print_serper_report(state, eval_body, deactivated)
        return 0

    wait_seconds = args.wait_seconds if args.wait_seconds is not None else WAIT_SECONDS

    if full or args.apply:
        state = preflight()
        apply_tasks(state)
        if args.apply and not full:
            print_report(state, None, None, None)
            return 0
    else:
        state = _require_state()

    eval_body = None
    items_result = None
    deactivated = None

    if full or args.wait:
        eval_body = wait_and_eval(state, seconds=wait_seconds)

    if full or args.items:
        items_result = create_items_via_assistant(state)

    if full or args.deactivate:
        deactivated = deactivate_live_eval_tasks()

    print_report(state, eval_body, items_result, deactivated)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except urllib.error.URLError as exc:
        _die(f"{SERVER_DOWN_ZH}\n原因：{exc.reason}")
