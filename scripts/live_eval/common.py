"""Shared constants, HTTP/state helpers, and evidence parsers for live-eval."""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, NoReturn

_PKG_DIR = Path(__file__).resolve().parent
_SCRIPT_DIR = _PKG_DIR.parent
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
    '  $env:IM_ACCESS_TOKEN = "<token>"\n'
    '  $env:VERIFY_BEARER = "<token>"\n'
    "本腳本不會代你登入、也不會改現有登入狀態。"
)

SERVER_DOWN_ZH = f"伺服器連不上 {BASE}。請先在本機跑 `npm run dev`（API 預設 http://127.0.0.1:18820）。"


def die(message: str, code: int = 2) -> NoReturn:
    reconfigure = getattr(sys.stderr, "reconfigure", None)
    if callable(reconfigure):
        reconfigure(encoding="utf-8", errors="replace")
    print(message, file=sys.stderr)
    raise SystemExit(code)


def load_state() -> dict[str, Any]:
    if not STATE_PATH.is_file():
        return {}
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def titles(rows: list[dict[str, Any]], *, key: str = "title", n: int = 3) -> list[str]:
    out: list[str] = []
    for row in rows:
        value = str(row.get(key) or row.get("topicName") or row.get("name") or "").strip()
        if value:
            out.append(value)
        if len(out) >= n:
            break
    return out


def channel_id(row: dict[str, Any]) -> str:
    cid = str(row.get("id") or "").strip()
    if cid:
        return cid
    return f"{row.get('platform')}:{row.get('platformId')}"


def channel_label(row: dict[str, Any]) -> str:
    return str(row.get("channelName") or row.get("sourceName") or row.get("id") or "?").strip()


def msg_time(msg: dict[str, Any]) -> str:
    return str(msg.get("timestamp") or msg.get("createdAt") or "")


def iso_now() -> datetime:
    return datetime.now(UTC)


def window_range() -> tuple[str, str]:
    now = iso_now()
    start = (now - timedelta(days=14)).strftime("%Y-%m-%dT00:00:00Z")
    end = (now + timedelta(days=45)).strftime("%Y-%m-%dT23:59:59Z")
    return start, end


def tool_evidence(ticks_payload: dict[str, Any]) -> dict[str, Any]:
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


def time_guess_notes(events: list[dict[str, Any]]) -> dict[str, Any]:
    with_time = [e for e in events if e.get("startTime")]
    without = [e for e in events if not e.get("startTime")]
    samples = [
        {
            "title": event.get("title"),
            "startTime": event.get("startTime"),
            "sourceMessageTime": event.get("sourceMessageTime"),
            "body": str(event.get("body") or "")[:160],
        }
        for event in events[:5]
    ]
    return {
        "withTime": len(with_time),
        "withoutTime": len(without),
        "samples": samples,
    }


def web_mode_used_search(mode: str | None) -> bool:
    text = str(mode or "")
    return text.startswith("agent:") and "no_web_tool" not in text and text != "agent:off"


__all__ = [
    "BASE",
    "CHAT_TIMEOUT",
    "MISSING_BEARER_ZH",
    "POLL_EVERY",
    "RRULE",
    "SAMPLE_MAX",
    "SAMPLE_MIN",
    "SERPER_PROMPT",
    "SERPER_RRULE",
    "SERPER_TASK_PREFIX",
    "SERPER_WAIT_SECONDS",
    "SERVER_DOWN_ZH",
    "STATE_PATH",
    "TASK_PREFIX",
    "THRESHOLD",
    "VERIFY_BEARER",
    "WAIT_SECONDS",
    "api",
    "channel_id",
    "channel_label",
    "die",
    "iso_now",
    "load_state",
    "msg_time",
    "save_state",
    "time_guess_notes",
    "titles",
    "tool_evidence",
    "web_mode_used_search",
    "window_range",
]
