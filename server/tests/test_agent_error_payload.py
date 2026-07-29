"""Unit tests for agent route error classification."""

from __future__ import annotations

from server.api.routes.agent import _agent_error_payload


def test_agent_error_payload_marks_connection_refused_as_unreachable() -> None:
    payload = _agent_error_payload(
        ConnectionError("Cannot connect to host localhost:11434 ssl:default [遠端電腦拒絕網路連線。]"),
        session_id="s1",
    )
    assert payload["error"] == "ai_engine_unreachable"
    assert payload["sessionId"] == "s1"
    assert "11434" in payload["message"]


def test_agent_error_payload_keeps_unknown_detail_as_error_code() -> None:
    payload = _agent_error_payload(RuntimeError("boom-xyz"), session_id=None)
    assert payload["error"] == "boom-xyz"
    assert payload["sessionId"] is None
