"""Task wire serializers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from server.domain.notify_prefs import normalize_notify_pref
from server.worksets_const import SYSTEM_WORKSET_ID


def serialize_task(row: Mapping[str, Any], channel_refs: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """AnalysisTask; ``channel_refs=None`` omits channelIds."""
    task = {
        "id": row["id"],
        "name": row.get("name") or "",
        "description": row.get("description"),
        "promptTemplate": row.get("prompt_template") or "",
        "analysisMode": row.get("analysis_mode") or "leaderboard",
        "analysisTimeRange": row.get("analysis_time_range") or "all",
        "version": int(row.get("version") or 1),
        "isActive": bool(row.get("is_active")),
        "scheduleRrule": row.get("schedule_rrule"),
        "includeInTimeline": bool(row.get("include_in_timeline", 1)),
        "worksetId": row.get("workset_id") or SYSTEM_WORKSET_ID,
        "agentWaveIntervalSeconds": (
            int(row["agent_wave_interval_seconds"]) if row.get("agent_wave_interval_seconds") is not None else None
        ),
        "batchOverlapCount": int(row["batch_overlap_count"]) if row.get("batch_overlap_count") is not None else None,
        "analysisTriggerThreshold": (
            int(row["analysis_trigger_threshold"]) if row.get("analysis_trigger_threshold") is not None else None
        ),
        "analysisBatchMessageLimit": (
            int(row["analysis_batch_message_limit"]) if row.get("analysis_batch_message_limit") is not None else None
        ),
        "analysisStrategyMode": row.get("analysis_strategy_mode") or None,
        "triggerMode": row.get("trigger_mode") or "schedule",
        "capCalendarRead": bool(row.get("cap_calendar_read", 1)),
        "capCalendarWrites": bool(row.get("cap_calendar_writes", 0)),
        "capWebSearch": bool(row.get("cap_web_search", 0)),
        "capForceWebSearch": bool(row.get("cap_force_web_search", 0)),
        "capReadAnalysisEvents": bool(row.get("cap_read_analysis_events", 1)),
        "capReadItems": bool(row.get("cap_read_items", 1)),
        "outputCalendar": bool(row.get("output_calendar", 0)),
        "outputAnalysisEvents": bool(row.get("output_analysis_events", 1)),
        "llmProfileId": row.get("llm_profile_id") or "",
        "notifyPref": normalize_notify_pref(row.get("notify_pref")),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }
    if channel_refs is not None:
        task["channelIds"] = channel_refs
    return task
