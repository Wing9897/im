"""Task, workset, and item wire serializers."""

from __future__ import annotations

from typing import Any, Mapping

from server.util import parse_json_list
from server.worksets_const import SYSTEM_WORKSET_ID


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
        "webSearchQuery": row.get("web_search_query") or "",
        "analysisMode": row.get("analysis_mode") or "leaderboard",
        "analysisTimeRange": row.get("analysis_time_range") or "all",
        "version": int(row.get("version") or 1),
        "isActive": bool(row.get("is_active")),
        "scheduleRrule": row.get("schedule_rrule"),
        "includeInTimeline": bool(row.get("include_in_timeline", 1)),
        "parentTaskId": row.get("parent_task_id") or None,
        "worksetId": row.get("workset_id") or None,
        "itemId": row.get("item_id") or None,
        "projectWaveIntervalSeconds": (
            int(row["project_wave_interval_seconds"]) if row.get("project_wave_interval_seconds") is not None else None
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


def serialize_item_category(row: Mapping[str, Any]) -> dict[str, Any]:
    from server.items.normalize import parse_field_schema_json

    remind = row.get("default_remind_before_days")
    raw_emoji = row.get("emoji")
    emoji = str(raw_emoji).strip() if isinstance(raw_emoji, str) and raw_emoji.strip() else None
    return {
        "id": str(row["id"]),
        "name": str(row.get("name") or ""),
        "slug": row.get("slug") or None,
        "sortOrder": int(row.get("sort_order") or 0),
        "color": row.get("color") or None,
        "emoji": emoji,
        "fieldSchema": parse_field_schema_json(row.get("field_schema")),
        "defaultRemindBeforeDays": int(remind) if remind is not None else None,
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def serialize_item(row: Mapping[str, Any]) -> dict[str, Any]:
    from server.items.normalize import parse_attributes_json

    remind = row.get("remind_before_days")
    raw_workset = row.get("workset_id")
    workset_id = str(raw_workset).strip() if isinstance(raw_workset, str) and raw_workset.strip() else SYSTEM_WORKSET_ID
    raw_category = row.get("category_id")
    category_id = str(raw_category).strip() if isinstance(raw_category, str) and raw_category.strip() else None
    raw_emoji = row.get("emoji")
    emoji = str(raw_emoji).strip() if isinstance(raw_emoji, str) and raw_emoji.strip() else None
    return {
        "id": str(row["id"]),
        "title": str(row.get("title") or ""),
        "categoryId": category_id,
        "worksetId": workset_id,
        "purchasedAt": row.get("purchased_at") or None,
        "expiresAt": row.get("expires_at") or None,
        "remindBeforeDays": int(remind) if remind is not None else None,
        "notes": str(row.get("notes") or ""),
        "status": str(row.get("status") or "active"),
        "emoji": emoji,
        "attributes": parse_attributes_json(row.get("attributes_json")),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }
