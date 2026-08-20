"""Analysis and calendar wire serializers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from server.domain.emoji import emoji_from_row
from server.domain.notify_prefs import normalize_notify_pref
from server.util import parse_json_list
from server.worksets_const import SYSTEM_WORKSET_ID


def serialize_trending_topic(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "taskId": row.get("task_id"),
        "batchId": row.get("batch_id"),
        "rank": row.get("rank"),
        "topicName": row.get("topic_name") or "",
        "score": float(row.get("score") or 0.0),
        "summary": row.get("summary"),
        "taskName": row.get("task_name"),
        "createdAt": row.get("created_at"),
        "messageCount": row.get("message_count"),
    }


def serialize_analysis_event(
    row: Mapping[str, Any],
    *,
    dismissed: bool = False,
    important: bool = False,
) -> dict[str, Any]:
    return {
        "id": row["id"],
        "taskId": row.get("task_id"),
        "version": int(row.get("version") or 1),
        "batchId": row.get("batch_id"),
        "title": row.get("title") or "",
        "body": row.get("body") or "",
        "startTime": row.get("start_time"),
        "endTime": row.get("end_time"),
        "location": row.get("location"),
        "latitude": row.get("latitude"),
        "longitude": row.get("longitude"),
        "participants": parse_json_list(row.get("participants_json")),
        "sourceMessageId": row.get("source_message_id"),
        "sourcePlatform": row.get("source_platform"),
        "sourceChannelName": row.get("source_channel_name"),
        "sourceMessageTime": row.get("source_message_time"),
        "analysisTimeRange": row.get("analysis_time_range"),
        "batchSourceChannelNames": parse_json_list(row.get("batch_source_channel_names")),
        "taskName": row.get("task_name"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "dismissed": bool(dismissed),
        "important": bool(important),
        "emoji": emoji_from_row(row),
    }


def serialize_dismissal(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "source": str(row["source"]),
        "eventId": str(row["event_id"]),
        "dismissedAt": row.get("dismissed_at"),
    }


def serialize_importance(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "source": str(row["source"]),
        "eventId": str(row["event_id"]),
        "markedAt": row.get("marked_at"),
    }


def serialize_user_event(
    row: Mapping[str, Any],
    *,
    dismissed: bool = False,
    important: bool = False,
) -> dict[str, Any]:
    location = row.get("location")
    raw_task_id = row.get("task_id")
    task_id = str(raw_task_id).strip() if isinstance(raw_task_id, str) and raw_task_id.strip() else ""
    raw_workset_id = row.get("workset_id")
    workset_id = (
        str(raw_workset_id).strip() if isinstance(raw_workset_id, str) and raw_workset_id.strip() else SYSTEM_WORKSET_ID
    )
    return {
        "id": str(row["id"]),
        "title": str(row.get("title") or ""),
        "body": str(row.get("body") or ""),
        "startTime": row.get("start_time"),
        "endTime": row.get("end_time") if row.get("end_time") else None,
        "location": location if isinstance(location, str) and location.strip() else None,
        "origin": str(row.get("origin") or ""),
        "isAllDay": bool(row.get("event_is_all_day")),
        "timezone": row.get("event_timezone") or None,
        "icsUid": row.get("ics_uid") or None,
        "icsSource": row.get("ics_source") or None,
        "remindBeforeDays": (int(row["remind_before_days"]) if row.get("remind_before_days") is not None else None),
        "taskId": task_id,
        "itemId": (
            str(row["item_id"]).strip()
            if isinstance(row.get("item_id"), str) and str(row.get("item_id")).strip()
            else None
        ),
        "worksetId": workset_id,
        "kind": str(row.get("kind") or "normal").strip() or "normal",
        "amount": (float(row["amount"]) if row.get("amount") is not None else None),
        "direction": (
            str(row["direction"]).strip()
            if isinstance(row.get("direction"), str) and str(row.get("direction")).strip()
            else None
        ),
        "notifyPref": normalize_notify_pref(row.get("notify_pref")),
        "emoji": emoji_from_row(row),
        "source": "user",
        "dismissed": bool(dismissed),
        "important": bool(important),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }
