"""snake_case DB rows → camelCase wire objects.

Neutral builders shared by HTTP routes and non-HTTP callers (ingestion,
calendar query, agent tools, …). Shapes match frontend TypeScript types.
"""

from __future__ import annotations

from typing import Any, Mapping

from server.action_config import masked_action_configuration
from server.util import parse_json_dict, parse_json_list
from server.worksets_const import SYSTEM_WORKSET_ID


def _message_media_from_raw(raw_data: Any) -> dict[str, Any] | None:
    if not raw_data:
        return None
    parsed = parse_json_dict(raw_data) if isinstance(raw_data, str) else raw_data
    media = parsed.get("media")
    if not isinstance(media, dict) or not media.get("kind"):
        return None
    result: dict[str, Any] = {"kind": str(media["kind"])}
    if media.get("mime"):
        result["mime"] = str(media["mime"])
    return result


def serialize_account(row: Mapping[str, Any]) -> dict[str, Any]:
    """Account — credentials are never exposed on the wire."""
    return {
        "id": row["id"],
        "platform": str(row["platform"]),
        "name": row.get("name") or "",
        "status": row.get("status") or "disconnected",
        "lastError": row.get("last_error"),
        "lastConnectedAt": row.get("last_connected_at"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def channel_key(platform: str, platform_id: str) -> str:
    """Synthetic frontend channel id: "platform:platformId"."""
    return f"{platform}:{platform_id}"


def serialize_channel(row: Mapping[str, Any]) -> dict[str, Any]:
    platform = str(row["platform"])
    platform_id = str(row["platform_id"])
    return {
        "id": channel_key(platform, platform_id),
        "platform": platform,
        "platformId": platform_id,
        "channelName": row.get("channel_name") or "",
        "createdAt": row.get("created_at"),
    }


def serialize_message(row: Mapping[str, Any]) -> dict[str, Any]:
    """Message — expects an optional joined ``channel_name`` column."""
    return {
        "id": row["id"],
        "accountId": row.get("account_id"),
        "platform": row["platform"],
        "platformId": row["platform_id"],
        "channelName": row.get("channel_name"),
        "platformMessageId": row.get("platform_message_id"),
        "senderId": row.get("sender_id"),
        "senderName": row.get("sender_name"),
        "content": row.get("content") or "",
        "timestamp": row.get("timestamp"),
        "rawData": row.get("raw_data"),
        "media": _message_media_from_raw(row.get("raw_data")),
        "createdAt": row.get("created_at"),
    }


def serialize_task(row: Mapping[str, Any], channel_refs: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """AnalysisTask; pass channel_refs=None to omit channelIds (toggle route)."""
    task = {
        "id": row["id"],
        "name": row.get("name") or "",
        "description": row.get("description"),
        "promptTemplate": row.get("prompt_template") or "",
        "analysisMode": row.get("analysis_mode") or "leaderboard",
        "analysisTimeRange": row.get("analysis_time_range") or "all",
        "version": int(row.get("version") or 1),
        "isActive": bool(row.get("is_active")),
        "scheduleType": row.get("schedule_type"),
        "scheduleValue": row.get("schedule_value"),
        "rrule": row.get("rrule"),
        "eventStartTime": row.get("event_start_time"),
        "eventEndTime": row.get("event_end_time"),
        "eventIsAllDay": bool(row.get("event_is_all_day")),
        "eventLocation": row.get("event_location"),
        "eventDescription": row.get("event_description"),
        "includeInTimeline": bool(row.get("include_in_timeline", 1)),
        "parentTaskId": row.get("parent_task_id") or None,
        "worksetId": row.get("workset_id") or None,
        "projectWaveIntervalSeconds": (
            int(row["project_wave_interval_seconds"]) if row.get("project_wave_interval_seconds") is not None else None
        ),
        "batchOverlapCount": (int(row["batch_overlap_count"]) if row.get("batch_overlap_count") is not None else None),
        "analysisTriggerThreshold": (
            int(row["analysis_trigger_threshold"]) if row.get("analysis_trigger_threshold") is not None else None
        ),
        "analysisBatchMessageLimit": (
            int(row["analysis_batch_message_limit"]) if row.get("analysis_batch_message_limit") is not None else None
        ),
        "analysisStrategyMode": row.get("analysis_strategy_mode") or None,
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }
    if channel_refs is not None:
        task["channelIds"] = channel_refs
    return task


def serialize_workset(row: Mapping[str, Any]) -> dict[str, Any]:
    """Workset ownership entity."""
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "isSystem": bool(row.get("is_system")),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def serialize_channel_ref(row: Mapping[str, Any]) -> dict[str, Any]:
    """ChannelRef inside AnalysisTask.channelIds."""
    platform = str(row["platform"])
    platform_id = str(row["platform_id"])
    return {
        "platform": platform,
        "platformId": platform_id,
        "id": channel_key(platform, platform_id),
    }


def serialize_action(row: Mapping[str, Any]) -> dict[str, Any]:
    action_type = str(row.get("action_type") or "")
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "actionType": action_type,
        "configuration": masked_action_configuration(row.get("configuration"), action_type),
        "triggerConditions": row.get("trigger_conditions"),
        "isEnabled": bool(row.get("is_enabled")),
        "lastTriggeredAt": row.get("last_triggered_at"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def serialize_action_trigger_history(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "actionId": row.get("action_id"),
        "taskId": row.get("task_id"),
        "batchId": row.get("batch_id"),
        "triggerReason": row.get("trigger_reason") or "",
        "status": row.get("status") or "",
        "errorMessage": row.get("error_message"),
        "triggeredAt": row.get("triggered_at"),
    }


def serialize_trending_topic(row: Mapping[str, Any]) -> dict[str, Any]:
    """TrendingTopic — expects joined ``task_name`` and ``message_count``."""
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


def serialize_analysis_event(row: Mapping[str, Any], *, dismissed: bool = False) -> dict[str, Any]:
    """AnalysisEvent — expects joins: task_name, analysis_time_range,
    source_platform, source_channel_name, source_message_time."""
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
    }


def serialize_user_event(row: Mapping[str, Any], *, dismissed: bool = False) -> dict[str, Any]:
    """API / calendar-query camelCase shape with ``source: user``."""
    location = row.get("location")
    raw_task_id = row.get("task_id")
    task_id = str(raw_task_id).strip() if isinstance(raw_task_id, str) and raw_task_id.strip() else ""
    raw_workset_id = row.get("workset_id")
    workset_id = (
        str(raw_workset_id).strip()
        if isinstance(raw_workset_id, str) and raw_workset_id.strip()
        else SYSTEM_WORKSET_ID
    )
    return {
        "id": str(row["id"]),
        "title": str(row.get("title") or ""),
        "body": str(row.get("body") or ""),
        "startTime": row.get("start_time"),
        "endTime": row.get("end_time") if row.get("end_time") else None,
        "location": location if isinstance(location, str) and location.strip() else None,
        "origin": str(row.get("origin") or ""),
        "taskId": task_id,
        "worksetId": workset_id,
        "source": "user",
        "dismissed": bool(dismissed),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def serialize_app_log(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "time": row.get("time"),
        "level": row.get("level"),
        "category": row.get("category"),
        "message": row.get("message"),
        "details": row.get("details"),
    }


def serialize_queue_batch(row: Mapping[str, Any]) -> dict[str, Any]:
    """Queue batch entry for ``GET /results/queue``."""
    return {
        "batchId": row["id"],
        "taskId": row["task_id"],
        "taskName": row["task_name"],
        "messageCount": int(row["message_count"] or 0),
        "status": row.get("status") or "pending",
        "retryCount": int(row.get("retry_count") or 0),
        "errorMessage": row.get("error_message"),
        "promptTokens": int(row.get("prompt_tokens") or 0),
        "completionTokens": int(row.get("completion_tokens") or 0),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def serialize_batch_tool_calls(raw: Any) -> list[dict[str, Any]]:
    """Parse ``analysis_batches.tool_calls_json`` into AgentToolCallSummary-shaped dicts."""
    if raw is None:
        return []
    if isinstance(raw, str):
        parsed = parse_json_list(raw)
    elif isinstance(raw, list):
        parsed = raw
    else:
        return []

    calls: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, Mapping):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        arguments = item.get("arguments")
        entry: dict[str, Any] = {
            "name": name.strip(),
            "arguments": arguments if isinstance(arguments, dict) else {},
            "resultSummary": "",
        }
        summary = item.get("resultSummary")
        if isinstance(summary, str):
            entry["resultSummary"] = summary
        calls.append(entry)
    return calls


def serialize_activity_span(row: Mapping[str, Any]) -> dict[str, Any]:
    """Gantt / project-detail activity span including last tick summary."""
    message = row.get("last_agent_message")
    if message is not None and not isinstance(message, str):
        message = str(message)
    error = row.get("last_error_message")
    if error is not None and not isinstance(error, str):
        error = str(error)
    raw_count = row.get("last_message_count")
    last_message_count = int(raw_count) if raw_count is not None else None
    source_kind = row.get("source_kind") or "task"
    if source_kind not in ("task", "workset"):
        source_kind = "task"
    # Workset ownership rows: taskId == worksetId (compat); task rows: null.
    workset_id: str | None = None
    if source_kind == "workset":
        raw_ws = row.get("workset_id")
        if isinstance(raw_ws, str) and raw_ws.strip():
            workset_id = raw_ws.strip()
        else:
            row_id = row.get("id")
            workset_id = str(row_id).strip() if row_id is not None else None
            if not workset_id:
                workset_id = None
    return {
        "taskId": row["id"],
        "taskName": row["name"],
        "description": row.get("description"),
        "analysisTimeRange": row.get("analysis_time_range") or "all",
        "isActive": bool(row.get("is_active")),
        "earliestBatchStart": row.get("earliest_start"),
        "latestBatchEnd": row.get("latest_end"),
        "completedBatchCount": int(row.get("completed_count") or 0),
        "lastAgentMessage": message if isinstance(message, str) and message.strip() else None,
        "lastToolCalls": serialize_batch_tool_calls(row.get("last_tool_calls_json")),
        "lastErrorMessage": error if isinstance(error, str) and error.strip() else None,
        "lastMessageCount": last_message_count,
        "sourceKind": source_kind,
        "worksetId": workset_id,
    }


def serialize_project_tick_log_entry(row: Mapping[str, Any]) -> dict[str, Any]:
    """One completed project-tick batch for the detail log."""
    message = row.get("agent_message")
    if message is not None and not isinstance(message, str):
        message = str(message)
    error = row.get("error_message")
    if error is not None and not isinstance(error, str):
        error = str(error)
    outcome = "error" if (isinstance(error, str) and error.strip()) else "success"
    if outcome == "success" and isinstance(message, str) and message.startswith("skipped:"):
        outcome = "skipped"
    return {
        "batchId": row["id"],
        "status": row.get("status") or "completed",
        "outcome": outcome,
        "messageCount": int(row.get("message_count") or 0),
        "agentMessage": message if isinstance(message, str) and message.strip() else None,
        "errorMessage": error if isinstance(error, str) and error.strip() else None,
        "toolCalls": serialize_batch_tool_calls(row.get("tool_calls_json")),
        "createdAt": row.get("created_at"),
        "completedAt": row.get("completed_at") or row.get("updated_at"),
    }


def serialize_project_tick_in_flight(row: Mapping[str, Any]) -> dict[str, Any]:
    """Pending/processing project-tick fire (waves still draining)."""
    return {
        "batchId": row["id"],
        "status": str(row.get("status") or "processing"),
        "messageCount": int(row.get("message_count") or 0),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }
