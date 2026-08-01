"""Unit tests for shared LLM tool-argument helpers."""

from __future__ import annotations

from server.agent.tool_args import arg, as_bool, as_optional_str


def test_arg_prefers_first_present_key() -> None:
    assert arg({"taskId": "a", "task_id": "b"}, "taskId", "task_id") == "a"
    assert arg({"task_id": "b"}, "taskId", "task_id") == "b"
    assert arg({}, "taskId", "task_id") is None


def test_arg_returns_explicit_empty_or_falsey() -> None:
    """Presence wins over truthiness (unlike ``a or b`` chains)."""
    assert arg({"taskId": "", "task_id": "fallback"}, "taskId", "task_id") == ""
    assert arg({"isActive": False}, "isActive", "is_active") is False


def test_as_optional_str_and_bool_aliases() -> None:
    assert as_optional_str(arg({"q": " hi "}, "query", "q", "search")) == "hi"
    assert as_bool(arg({"is_active": "yes"}, "isActive", "is_active"), False) is True
