"""Pure parsing and normalization helpers for the agent runtime."""

from __future__ import annotations

import json
from typing import Any

from server.agent.tools_tasks import CONSULT_ADVISOR_TOOL_NAME


def messages_for_channel(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalize client messages; client-supplied system roles are ignored."""
    normalized: list[dict[str, Any]] = []
    for message in messages:
        role = str(message.get("role") or "").strip()
        content = message.get("content")
        if role not in {"user", "assistant", "system"} or content is None:
            continue
        if role == "system":
            continue
        normalized.append({"role": role, "content": str(content)})
    return normalized


def normalize_tool_calls(parsed: Any) -> list[dict[str, Any]] | None:
    if not isinstance(parsed, dict):
        return None
    raw = parsed.get("tool_calls") or parsed.get("toolCalls")
    if raw is None and parsed.get("tool"):
        raw = [
            {
                "name": parsed.get("tool"),
                "arguments": parsed.get("arguments") or parsed.get("args") or {},
            }
        ]
    if not isinstance(raw, list) or not raw:
        return None
    calls: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("tool")
        if not name:
            continue
        args = item.get("arguments") if "arguments" in item else item.get("args")
        if args is None:
            args = {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except (json.JSONDecodeError, TypeError):
                args = {"raw": args}
        if not isinstance(args, dict):
            args = {}
        calls.append({"name": str(name), "arguments": args})
    return calls or None


def extract_final_message(parsed: Any, raw_text: str) -> str | None:
    if isinstance(parsed, dict):
        for key in ("message", "final", "answer", "content"):
            value = parsed.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        if "tool_calls" in parsed or "toolCalls" in parsed or "tool" in parsed:
            return None
    text = (raw_text or "").strip()
    return text or None


def summarize_tool_result(name: str, result: dict[str, Any]) -> str:
    if result.get("error"):
        return f"{name}: error={result['error']}"
    if name == CONSULT_ADVISOR_TOOL_NAME:
        if result.get("taskConfig"):
            return f"{name}: taskConfig updated"
        return f"{name}: ok"
    if "calendars" in result:
        return f"{name}: {result.get('count', len(result.get('calendars') or []))} calendars"
    task = result.get("task")
    if isinstance(task, dict) and task.get("id"):
        return f"{name}: task={task.get('id')}"
    items = result.get("items")
    if isinstance(items, list):
        if name.startswith("web."):
            titles = [
                str(item.get("title") or "")[:40] for item in items[:3] if isinstance(item, dict) and item.get("title")
            ]
            title_bit = f" ({'; '.join(titles)})" if titles else ""
            provider = result.get("provider")
            provider_bit = f" via {provider}" if provider else ""
            return f"{name}: {len(items)} results{provider_bit}{title_bit}"
        if name.startswith("messages."):
            return f"{name}: {result.get('count', len(items))} messages"
        if name.startswith("intelligence."):
            return f"{name}: {result.get('count', len(items))} events"
        return f"{name}: {len(items)} items"
    if result.get("item") is not None:
        return f"{name}: 1 item"
    if result.get("deleted") is True:
        return f"{name}: deleted"
    return f"{name}: ok"


def pick_task_config(result: dict[str, Any]) -> dict[str, Any] | None:
    if result.get("error"):
        return None
    config = result.get("taskConfig")
    if isinstance(config, dict) and config:
        return config
    return None


def final_event(
    *,
    message: str,
    session_id: str | None,
    tool_calls: list[dict[str, Any]],
    error: str | None = None,
    task_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": "final",
        "message": message,
        "sessionId": session_id,
        "toolCalls": tool_calls,
    }
    if error:
        payload["error"] = error
    if task_config is not None:
        payload["taskConfig"] = task_config
    return payload
