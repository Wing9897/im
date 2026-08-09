"""Task and workset wire serializers."""

from __future__ import annotations

from typing import Any, Mapping

from server.util import parse_json_list


def _recurring_wire_clock(row: Mapping[str, Any], key: str) -> Any:
    value = row.get(key)
    if not value:
        return value
    if row.get("event_is_all_day"):
        return None
    if row.get("ics_source") or str(row.get("event_timezone") or "") != "floating":
        return value
    text = str(value)
    if "T" in text and len(text) >= 16:
        return text.split("T", 1)[1][:5]
    return value


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
        "parentTaskId": row.get("parent_task_id") or None,
        "worksetId": row.get("workset_id") or None,
        "itemId": row.get("item_id") or None,
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
        "outputAnalysisEvents": bool(row.get("output_analysis_events", 0)),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }
    if channel_refs is not None:
        task["channelIds"] = channel_refs
    return task


def serialize_task_schedule(row: Mapping[str, Any]) -> dict[str, Any] | None:
    if not row.get("rrule"):
        return None
    return {
        "taskId": row["id"],
        "rrule": row.get("rrule"),
        "eventStartTime": _recurring_wire_clock(row, "event_start_time"),
        "eventEndTime": _recurring_wire_clock(row, "event_end_time"),
        "eventIsAllDay": bool(row.get("event_is_all_day")),
        "eventLocation": row.get("event_location"),
        "eventDescription": row.get("event_description"),
        "eventTimezone": row.get("event_timezone"),
        "eventStartLocal": row.get("event_start_local"),
        "eventEndLocal": row.get("event_end_local"),
        "eventExdates": parse_json_list(row.get("event_exdates_json")),
        "eventRdates": parse_json_list(row.get("event_rdates_json")),
        "icsUid": row.get("ics_uid"),
        "icsSource": row.get("ics_source"),
        "parentTaskId": row.get("parent_task_id") or None,
        "itemId": row.get("item_id") or None,
    }


def serialize_task_for_agent(
    row: Mapping[str, Any],
    channel_refs: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    task = serialize_task(row, channel_refs)
    schedule = serialize_task_schedule(row)
    if schedule is not None:
        task.update({key: value for key, value in schedule.items() if key != "taskId"})
    return task


def serialize_workset(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "isSystem": bool(row.get("is_system")),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }

