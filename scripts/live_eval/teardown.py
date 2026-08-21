"""Live-eval teardown: deactivate tasks and print reports."""

from __future__ import annotations

from typing import Any

from .common import (
    TASK_PREFIX,
    api,
    die,
    time_guess_notes,
    titles,
    tool_evidence,
    web_mode_used_search,
)


def deactivate_live_eval_tasks(prefix: str = TASK_PREFIX) -> list[dict[str, Any]]:
    status, tasks = api("GET", "/api/v1/tasks")
    if status != 200 or not isinstance(tasks, list):
        die(f"GET /tasks 失敗 status={status}")
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


def print_report(
    state: dict[str, Any],
    eval_body: dict[str, Any] | None,
    items_result: dict[str, Any] | None,
    deactivated: list[dict[str, Any]] | None,
) -> None:
    tasks = state.get("tasks") or {}
    eval_body = eval_body or {}
    items_result = items_result or {}
    scout_ev = tool_evidence(eval_body.get("scoutTicks") or {})
    cal_ev = tool_evidence(eval_body.get("calendarTicks") or {})
    queue = eval_body.get("queue") or {}
    intel = eval_body.get("intelEvents") or []
    sched = eval_body.get("scheduleEvents") or []
    scout_events = eval_body.get("scoutEvents") or []
    trending = eval_body.get("trending") or []
    win_a = eval_body.get("windowAnalysis") or []
    win_u = eval_body.get("windowUser") or []
    time_notes = time_guess_notes(sched or intel)

    print("\n========== live-eval 效果報告 ==========")
    print("【前置】")
    print(
        f"  設定檔 {state.get('profileId')} / {state.get('profileName')} "
        f"provider={state.get('provider')} model={state.get('model')} "
        f"webSearch={state.get('webSearchProvider')}"
        f"{'（已從 auto PATCH 成 serper）' if state.get('webSearchPatched') else ''}"
    )
    print(f"  Telegram：{', '.join(state.get('telegramSources') or [])}")
    print("  抽樣對話：" + ", ".join(f"{c.get('label')} ({c.get('id')})" for c in state.get("sampledChannels") or []))

    print("【任務】")
    for key, row in tasks.items():
        print(f"  {key}: {row.get('id')}  {row.get('name')}  mode={row.get('analysisMode')}")

    print("【產出】")
    print(
        f"  隊列 paused={queue.get('analysisPaused')} pending={queue.get('pendingCount')} "
        f"processing={len(queue.get('processingBatches') or [])} "
        f"attention={len(queue.get('attentionBatches') or [])}"
    )
    if queue.get("attentionBatches"):
        for batch in (queue.get("attentionBatches") or [])[:5]:
            print(f"    attention {batch.get('taskName')}: {batch.get('errorMessage') or batch.get('status')}")
    print(f"  情報事件 intel={len(intel)} 例：{titles(intel) or '（空）'}")
    print(f"  行程推理 schedule={len(sched)} 例：{titles(sched) or '（空）'}")
    print(f"  Scout 事件={len(scout_events)} 例：{titles(scout_events) or '（空）'}")
    print(f"  排行榜={len(trending)} 例：{titles(trending, key='topicName') or '（空）'}")
    print(f"  日曆 window analysis={len(win_a)} 例：{titles(win_a) or '（空）'}")
    print(f"  日曆 window user/agent={len(win_u)} 例：{titles(win_u) or '（空）'}")

    print("【時間質量】")
    print(f"  有 startTime={time_notes['withTime']} 無時間={time_notes['withoutTime']}")
    for sample in time_notes["samples"][:3]:
        print(f"    · {sample.get('title')} start={sample.get('startTime')} msgTime={sample.get('sourceMessageTime')}")

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
        print(f"  例：{titles(items_result.get('items') or []) or '（空）'}")
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
    gaps.extend(
        f"attention: {batch.get('taskName')} {batch.get('errorMessage')}"
        for batch in queue.get("attentionBatches") or []
    )
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


def print_serper_report(
    state: dict[str, Any],
    eval_body: dict[str, Any],
    deactivated: list[dict[str, Any]] | None,
) -> None:
    task = (state.get("tasks") or {}).get("web_scout_serper") or {}
    scout_ev = tool_evidence(eval_body.get("scoutTicks") or {})
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
        and any(web_mode_used_search(mode) for mode in sse_modes)
    )
    serper_ran = bool(
        scout_ev["searches"] > 0
        or any(web_mode_used_search(mode) for mode in sse_modes)
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
    print(f"  analysis_events={len(events)} 例：{titles(events) or '（空）'}")
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
