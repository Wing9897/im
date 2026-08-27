"""Agent runtime parse helpers (tool-result summaries)."""

from __future__ import annotations

from server.agent.runtime_parse import summarize_tool_result as _summarize_tool_result


def test_summarize_hard_delete_as_deleted() -> None:
    assert (
        _summarize_tool_result(
            "calendar.delete_recurring_series",
            {"deleted": True, "id": "s1"},
        )
        == "calendar.delete_recurring_series: deleted"
    )


def test_summarize_delete_event_as_dismissed() -> None:
    assert (
        _summarize_tool_result(
            "calendar.delete_event",
            {"deleted": True, "dismissed": True, "id": "e1"},
        )
        == "calendar.delete_event: dismissed"
    )
