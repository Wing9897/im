"""Unit tests for agent error classification (status code + error code)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from server.api.agent_errors import (
    agent_http_error,
    agent_stream_error_event,
    agent_timeout_http_error,
)


def _body(error: HTTPException) -> dict[str, Any]:
    """Starlette types ``detail`` as ``str``; ``http_error`` always sends a dict."""
    detail = error.detail
    assert isinstance(detail, dict)
    return detail


def test_connection_refused_maps_to_503_unreachable() -> None:
    exc = ConnectionError("Cannot connect to host localhost:11434 ssl:default [遠端電腦拒絕網路連線。]")
    error = agent_http_error(exc)
    assert error.status_code == 503
    assert _body(error)["error_code"] == "ai_engine_unreachable"
    assert "11434" in _body(error)["message"]


def test_other_failures_map_to_502_with_detail_preserved() -> None:
    error = agent_http_error(RuntimeError("boom-xyz"))
    assert error.status_code == 502
    assert _body(error)["error_code"] == "ai_engine_failed"
    assert _body(error)["details"] == {"detail": "boom-xyz"}


def test_timeout_maps_to_504() -> None:
    error = agent_timeout_http_error()
    assert error.status_code == 504
    assert _body(error)["error_code"] == "agent_timeout"


def test_stream_error_event_keeps_in_band_shape() -> None:
    payload = agent_stream_error_event(ConnectionError("connection refused"), session_id="s1")
    assert payload["type"] == "error"
    assert payload["error"] == "ai_engine_unreachable"
    assert payload["sessionId"] == "s1"
    assert payload["toolCalls"] == []
