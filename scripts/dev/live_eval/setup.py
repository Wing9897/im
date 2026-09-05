"""Live-eval setup: preflight, Telegram sampling, and task upsert."""

from __future__ import annotations

import urllib.error
import urllib.parse
from typing import Any

from server.db.schema_inspect import CURRENT_SCHEMA_VERSION

from .common import (
    BASE,
    MISSING_BEARER_ZH,
    RRULE,
    SAMPLE_MAX,
    SAMPLE_MIN,
    SERPER_PROMPT,
    SERPER_RRULE,
    SERPER_TASK_PREFIX,
    SERVER_DOWN_ZH,
    TASK_PREFIX,
    THRESHOLD,
    VERIFY_BEARER,
    api,
    channel_id,
    channel_label,
    die,
    iso_now,
    msg_time,
    save_state,
)


def preflight() -> dict[str, Any]:
    if not VERIFY_BEARER:
        die(MISSING_BEARER_ZH)

    try:
        status, health = api("GET", "/api/v1/health", timeout=10)
    except urllib.error.URLError as exc:
        die(f"{SERVER_DOWN_ZH}\n原因：{exc.reason}")

    if status != 200 or not isinstance(health, dict):
        die(f"GET /api/v1/health 失敗 status={status} body={health!r}")

    stamp = health.get("schemaVersion")
    if stamp != CURRENT_SCHEMA_VERSION:
        die(f"schemaVersion 不是 {CURRENT_SCHEMA_VERSION}（實際 {stamp}）。本評估假設當前 schema stamp。")

    print(f"[preflight] health ok stamp={stamp} version={health.get('version')} base={BASE}")

    status, tg_sources = api("GET", "/api/v1/sources/telegram")
    if status == 401:
        die(MISSING_BEARER_ZH)
    if status != 200 or not isinstance(tg_sources, list):
        die(f"GET /sources/telegram 失敗 status={status}")
    connected = [
        row for row in tg_sources if isinstance(row, dict) and str(row.get("status") or "").lower() == "connected"
    ]
    if not connected:
        names = [f"{row.get('name')}({row.get('status')})" for row in tg_sources if isinstance(row, dict)]
        die(f"Telegram 未登入／未 connected。現有來源：{names or '（空）'}")
    tg_names = [str(row.get("name") or row.get("id")) for row in connected]
    print(f"[preflight] telegram connected: {tg_names}")

    status, profiles = api("GET", "/api/v1/llm/profiles")
    if status != 200 or not isinstance(profiles, list):
        die(f"GET /llm/profiles 失敗 status={status}")

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
        die("找不到第一個完整 Gemini 設定檔（provider=gemini_compatible、有 model 與 apiKey）。")

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
            die("設定檔 webSearchProvider=auto，但沒有 Serper key；未改登入、也未臆造金鑰。")
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
            die(f"PATCH profile → serper 失敗 status={status} body={updated!r}")
        search_provider = str(updated.get("webSearchProvider") or "serper")
        patched = True
        print(f"[preflight] patched webSearchProvider auto → {search_provider}")
    elif search_provider != "serper":
        print(f"[preflight] webSearchProvider={search_provider}（不是 auto，未改）")

    sampled = _sample_telegram_channels()
    print("[preflight] sampled channels: " + ", ".join(f"{c['label']} ({c['id']})" for c in sampled))

    state = {
        "profileId": profile_id,
        "profileName": gemini.get("name"),
        "provider": gemini.get("provider"),
        "model": gemini.get("model"),
        "webSearchProvider": search_provider,
        "webSearchPatched": patched,
        "telegramSources": tg_names,
        "sampledChannels": sampled,
        "createdAt": iso_now().isoformat(),
    }
    save_state(state)
    return state


def _sample_telegram_channels() -> list[dict[str, Any]]:
    status, channels = api("GET", "/api/v1/channels")
    if status != 200 or not isinstance(channels, list):
        die(f"GET /channels 失敗 status={status}")

    telegram_rows = [row for row in channels if isinstance(row, dict) and str(row.get("platform") or "") == "telegram"]
    if not telegram_rows:
        die("沒有 telegram channel 可抽樣。")

    ranked: list[tuple[str, dict[str, Any], list[dict[str, Any]]]] = []
    for offset in range(0, len(telegram_rows), 80):
        chunk = telegram_rows[offset : offset + 80]
        keys = [channel_id(row) for row in chunk]
        query = urllib.parse.urlencode({"channels": ",".join(keys), "limit": "5"})
        status, latest = api("GET", f"/api/v1/channels/latest-messages?{query}")
        if status != 200 or not isinstance(latest, dict):
            die(f"GET /channels/latest-messages 失敗 status={status}")
        by_id = {channel_id(row): row for row in chunk}
        for cid, messages in latest.items():
            msgs = [m for m in (messages or []) if isinstance(m, dict)]
            if not msgs:
                continue
            newest = max((msg_time(m) for m in msgs), default="")
            row = by_id.get(str(cid)) or {"id": cid, "platform": "telegram"}
            ranked.append((newest, row, msgs))

    ranked.sort(key=lambda item: item[0], reverse=True)
    picked = ranked[:SAMPLE_MAX]
    if len(picked) < SAMPLE_MIN:
        die(f"有訊息的 Telegram 對話不足 {SAMPLE_MIN} 個（實際 {len(picked)}）。請確認 collector 已拉到近期訊息。")

    sampled: list[dict[str, Any]] = []
    for newest, row, msgs in picked:
        snippets = []
        for msg in msgs[:3]:
            text = str(msg.get("content") or "").replace("\n", " ").strip()
            snippets.append(
                {
                    "id": msg.get("id"),
                    "time": msg_time(msg),
                    "sender": msg.get("senderName"),
                    "text": text[:280],
                }
            )
        sampled.append(
            {
                "id": channel_id(row),
                "label": channel_label(row),
                "newest": newest,
                "snippets": snippets,
            }
        )
    return sampled


def _preset_prompt(templates: list[dict[str, Any]], preset_id: str) -> str:
    for row in templates:
        if row.get("id") == preset_id:
            return str(row.get("promptTemplate") or "").strip()
    die(f"找不到任務模板 {preset_id}")
    raise AssertionError


def _task_channel_ids(state: dict[str, Any]) -> list[str]:
    return [str(c["id"]) for c in state.get("sampledChannels") or []]


def _upsert_task(name: str, body: dict[str, Any]) -> dict[str, Any]:
    status, tasks = api("GET", "/api/v1/tasks")
    if status != 200 or not isinstance(tasks, list):
        die(f"GET /tasks 失敗 status={status}")
    existing = next((row for row in tasks if isinstance(row, dict) and row.get("name") == name), None)
    if existing:
        put_body = {**body, "isActive": True}
        status, payload = api("PUT", f"/api/v1/tasks/{existing['id']}", put_body)
        if status != 200 or not isinstance(payload, dict):
            die(f"PUT {name} 失敗 status={status} body={payload!r}")
        print(f"[apply] updated {name} id={payload.get('id')} active={payload.get('isActive')}")
        return payload
    status, payload = api("POST", "/api/v1/tasks", {**body, "isActive": True})
    if status not in {200, 201} or not isinstance(payload, dict):
        die(f"POST {name} 失敗 status={status} body={payload!r}")
    print(f"[apply] created {name} id={payload.get('id')}")
    return payload


def apply_tasks(state: dict[str, Any]) -> dict[str, Any]:
    status, templates = api("GET", "/api/v1/tasks/templates")
    if status != 200 or not isinstance(templates, list):
        die(f"GET /tasks/templates 失敗 status={status}")

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
    save_state(state)
    return created


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
    save_state(state)
    return saved
