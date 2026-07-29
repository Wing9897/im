"""Tests for LLM JSON parsing helpers."""

from __future__ import annotations

import pytest

from server.analyzer.llm_json import parse_json_response, strip_reasoning_preamble


def test_strip_reasoning_preamble_removes_closed_redacted_block() -> None:
    raw = '<think>internal reasoning</think>\n{"items": [{"title": "ok"}]}'
    assert strip_reasoning_preamble(raw) == '{"items": [{"title": "ok"}]}'


def test_strip_reasoning_preamble_finds_json_after_unclosed_thinking() -> None:
    raw = '<think>嗯，用户给了…\n{"items": []}'
    assert strip_reasoning_preamble(raw) == '{"items": []}'


def test_parse_json_response_tolerates_leaked_thinking_before_json() -> None:
    raw = '<think>分析中…</think>\n{"items": [{"title": "Intel", "content": "Body"}]}'
    parsed = parse_json_response(raw)
    assert parsed == {"items": [{"title": "Intel", "content": "Body"}]}


def test_parse_json_response_still_raises_when_no_json() -> None:
    with pytest.raises(ValueError, match="Failed to parse LLM response as JSON"):
        parse_json_response("<think>只有推理，沒有 JSON")
