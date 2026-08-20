"""Live-eval poll: wait loops, SSE evidence, assistant items, and eval collection."""

from __future__ import annotations

import json
import threading
import time
import urllib.parse
import urllib.request
from typing import Any

from .common import (
    BASE,
    CHAT_TIMEOUT,
    POLL_EVERY,
    SERPER_WAIT_SECONDS,
    VERIFY_BEARER,
    WAIT_SECONDS,
    api,
    die,
    save_state,
    tool_evidence,
    web_mode_used_search,
    window_range,
)


def events_for_task(task_id: str, limit: int = 30) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"taskId": task_id, "limit": str(limit), "sort": "analyzed_at"})
    status, body = api("GET", f"/api/v1/results/events?{query}")
    if status != 200 or not isinstance(body, dict):
        return []
    items = body.get("items") or []
    return [row for row in items if isinstance(row, dict)]


def trending_for_task(task_id: str) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"taskId": task_id})
    status, body = api("GET", f"/api/v1/results/trending?{query}")
    if status != 200:
        return []
    if isinstance(body, list):
        return [row for row in body if isinstance(row, dict)]
    if isinstance(body, dict):
        return [row for row in (body.get("items") or []) if isinstance(row, dict)]
    return []


def calendar_window() -> dict[str, list[dict[str, Any]]]:
    start, end = window_range()
    query = urllib.parse.urlencode(
        {
            "startTime": start,
            "endTime": end,
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


def agent_ticks(task_id: str) -> dict[str, Any]:
    status, body = api("GET", f"/api/v1/tasks/{task_id}/agent-ticks?limit=20")
    if status != 200 or not isinstance(body, dict):
        return {"status": status, "ticks": [], "error": body}
    return body


def collect_eval(state: dict[str, Any]) -> dict[str, Any]:
    tasks = state.get("tasks") or {}
    status, queue = api("GET", "/api/v1/results/queue")
    intel_id = (tasks.get("intel") or {}).get("id")
    sched_id = (tasks.get("schedule") or {}).get("id")
    board_id = (tasks.get("leaderboard") or {}).get("id")
    scout_id = (tasks.get("web_scout") or {}).get("id")
    cal_id = (tasks.get("calendar") or {}).get("id")

    intel_events = events_for_task(intel_id) if intel_id else []
    sched_events = events_for_task(sched_id) if sched_id else []
    scout_events = events_for_task(scout_id) if scout_id else []
    trending = trending_for_task(board_id) if board_id else []
    window = calendar_window()
    scout_ticks = agent_ticks(scout_id) if scout_id else {"ticks": []}
    cal_ticks = agent_ticks(cal_id) if cal_id else {"ticks": []}

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


def tick_progress(eval_body: dict[str, Any]) -> tuple[int, int]:
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
        eval_body = collect_eval(state)
        produced, activity = tick_progress(eval_body)
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
    save_state(state)
    return eval_body


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
    item_rows = (
        [row for row in items if isinstance(row, dict)] if status_items == 200 and isinstance(items, list) else []
    )
    tool_calls = payload.get("toolCalls") if isinstance(payload, dict) else []
    created_calls = [
        call for call in (tool_calls or []) if isinstance(call, dict) and str(call.get("name") or "") == "items.create"
    ]
    return {
        "status": status,
        "message": (payload.get("message") if isinstance(payload, dict) else None),
        "toolCalls": tool_calls,
        "itemsCreateCalls": created_calls,
        "items": item_rows,
        "itemCount": len(item_rows),
    }


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


def collect_app_logs(limit: int = 80) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode({"limit": str(limit)})
    status, body = api("GET", f"/api/v1/logs?{query}")
    if status != 200 or not isinstance(body, dict):
        return []
    rows = body.get("logs") or body.get("items") or []
    return [row for row in rows if isinstance(row, dict)]


def log_mentions_search(rows: list[dict[str, Any]]) -> list[str]:
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


def wait_serper_eval(state: dict[str, Any], *, seconds: int = SERPER_WAIT_SECONDS) -> dict[str, Any]:
    task = (state.get("tasks") or {}).get("web_scout_serper") or {}
    task_id = str(task.get("id") or "")
    if not task_id:
        die("沒有 serper 任務 id")

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
            ticks_payload = agent_ticks(task_id)
            events = events_for_task(task_id)
            evidence = tool_evidence(ticks_payload)
            status_q, queue = api("GET", "/api/v1/results/queue")
            logs = collect_app_logs()
            log_hits = log_mentions_search(logs)
            our_sse = [
                item
                for item in sse_events
                if str((item.get("payload") or {}).get("taskId") or "") == task_id or item.get("type") == "sse_error"
            ]
            sse_modes = [
                str((item.get("payload") or {}).get("webSearchMode") or "")
                for item in our_sse
                if item.get("type") == "analysis_completed"
            ]
            sse_hit = any(web_mode_used_search(mode) for mode in sse_modes)
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
    save_state(state)
    return eval_body
