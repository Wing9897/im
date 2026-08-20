"""Actions, logs, queue, and agent-status wire serializers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from server.action_config import masked_action_configuration
from server.util import parse_json_list


def parse_tool_call_entries(raw: Any) -> list[dict[str, Any]]:
    """Shared parse of agent-tick tool-call JSON (DB string or in-memory list).

    Each entry has ``name`` and optionally ``arguments`` (dict) and
    ``resultSummary`` (str). Invalid items are skipped. Wrappers add
    storage vs HTTP defaults: :func:`serialize_tick_tool_calls` (DB string)
    and :func:`serialize_batch_tool_calls` (HTTP list).
    """
    parsed = raw if isinstance(raw, list) else parse_json_list(raw)
    entries: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, Mapping):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        entry: dict[str, Any] = {"name": name.strip()}
        arguments = item.get("arguments")
        if isinstance(arguments, dict):
            entry["arguments"] = arguments
        summary = item.get("resultSummary")
        if isinstance(summary, str):
            entry["resultSummary"] = summary
        entries.append(entry)
    return entries


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


def serialize_app_log(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "time": row.get("time"),
        "level": row.get("level"),
        "category": row.get("category"),
        "kind": row.get("kind"),
        "message": row.get("message"),
        "details": row.get("details"),
    }


def serialize_queue_batch(row: Mapping[str, Any]) -> dict[str, Any]:
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
    """HTTP list wrapper: missing arguments/summary become ``{}`` / ``""``."""
    calls: list[dict[str, Any]] = []
    for item in parse_tool_call_entries(raw):
        arguments = item.get("arguments")
        summary = item.get("resultSummary")
        calls.append(
            {
                "name": item["name"],
                "arguments": arguments if isinstance(arguments, dict) else {},
                "resultSummary": summary if isinstance(summary, str) else "",
            }
        )
    return calls


def serialize_activity_span(row: Mapping[str, Any]) -> dict[str, Any]:
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
    workset_id: str | None = None
    task_id: str | None = None
    if source_kind == "workset":
        raw_ws = row.get("workset_id")
        if isinstance(raw_ws, str) and raw_ws.strip():
            workset_id = raw_ws.strip()
        else:
            row_id = row.get("id")
            workset_id = str(row_id).strip() if row_id is not None else None
            if not workset_id:
                workset_id = None
    else:
        row_id = row.get("id")
        task_id = str(row_id) if row_id is not None else None
    return {
        "taskId": task_id,
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


def serialize_agent_tick_log_entry(row: Mapping[str, Any]) -> dict[str, Any]:
    message = row.get("agent_message")
    if message is not None and not isinstance(message, str):
        message = str(message)
    error = row.get("error_message")
    if error is not None and not isinstance(error, str):
        error = str(error)
    outcome = "error" if isinstance(error, str) and error.strip() else "success"
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


def serialize_agent_tick_in_flight(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "batchId": row["id"],
        "status": str(row.get("status") or "processing"),
        "messageCount": int(row.get("message_count") or 0),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }
