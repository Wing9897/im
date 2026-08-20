"""Shared agent-tick tool-call parse: DB string vs HTTP list wrappers."""

from __future__ import annotations

import json

from server.scheduler.agent_tick_format import serialize_tick_tool_calls
from server.wire.serializers import parse_tool_call_entries, serialize_batch_tool_calls


def test_parse_tool_call_entries_from_json_string_and_list() -> None:
    raw = '[{"name": "web.search", "arguments": {"q": "x"}, "resultSummary": "ok"}]'
    from_str = parse_tool_call_entries(raw)
    from_list = parse_tool_call_entries(json.loads(raw))
    assert from_str == from_list
    assert from_str == [{"name": "web.search", "arguments": {"q": "x"}, "resultSummary": "ok"}]


def test_parse_tool_call_entries_skips_invalid() -> None:
    assert parse_tool_call_entries(None) == []
    assert parse_tool_call_entries({"name": "nope"}) == []
    parsed = parse_tool_call_entries(
        [
            {"name": ""},
            {"name": "  "},
            "skip",
            {"name": " calendar.upcoming "},
        ]
    )
    assert parsed == [{"name": "calendar.upcoming"}]


def test_http_wrapper_fills_defaults() -> None:
    calls = serialize_batch_tool_calls('[{"name":"web.search"}]')
    assert calls == [{"name": "web.search", "arguments": {}, "resultSummary": ""}]


def test_db_wrapper_roundtrips_to_http_list() -> None:
    payload = serialize_tick_tool_calls(
        [
            {
                "name": "calendar.upcoming",
                "arguments": {"limit": 5},
                "resultSummary": "ok",
            },
            {"name": ""},
        ]
    )
    assert '"name": "calendar.upcoming"' in payload
    assert serialize_batch_tool_calls(payload) == [
        {"name": "calendar.upcoming", "arguments": {"limit": 5}, "resultSummary": "ok"}
    ]
    assert serialize_tick_tool_calls(None) == "[]"


def test_db_wrapper_truncates_long_arguments() -> None:
    payload = serialize_tick_tool_calls([{"name": "web.search", "arguments": {"q": "x" * 500}}])
    parsed = json.loads(payload)
    assert "_truncated" in parsed[0]["arguments"]
