"""Unit tests for server/analyzer/token_budget.py."""

from __future__ import annotations

import pytest

from server.analyzer.token_budget import (
    DEFAULT_TOKEN_BUDGET,
    TokenBudgetResult,
    apply_token_budget,
    estimate_tokens,
)


def test_estimate_tokens_empty_and_none() -> None:
    assert estimate_tokens(None) == 0
    assert estimate_tokens("") == 0


def test_estimate_tokens_ascii_uses_char_division() -> None:
    # 8 ASCII chars -> ceil(8/4) = 2
    assert estimate_tokens("abcdefgh") == 2


def test_estimate_tokens_cjk_uses_higher_weight() -> None:
    # 2 CJK chars -> ceil(2 * 0.7) = 2
    assert estimate_tokens("中文") == 2


def test_apply_token_budget_keeps_prefix_within_budget() -> None:
    messages = [
        {"content": "a" * 8},
        {"content": "b" * 8},
        {"content": "c" * 8},
    ]

    result = apply_token_budget(messages, max_tokens=5)

    assert isinstance(result, TokenBudgetResult)
    assert len(result.messages) == 2
    assert result.estimated_tokens == 4


def test_apply_token_budget_empty_input() -> None:
    result = apply_token_budget([], max_tokens=DEFAULT_TOKEN_BUDGET)

    assert result.messages == []
    assert result.estimated_tokens == 0


def test_apply_token_budget_stops_before_overflow() -> None:
    messages = [{"content": "x" * 40}, {"content": "y" * 40}]

    result = apply_token_budget(messages, max_tokens=10)

    assert len(result.messages) == 1
    assert result.estimated_tokens == 10


@pytest.mark.parametrize("max_tokens", [0, -5])
def test_apply_token_budget_zero_budget_returns_empty(max_tokens: int) -> None:
    messages = [{"content": "hello"}]

    result = apply_token_budget(messages, max_tokens=max_tokens)

    assert result.messages == []
    assert result.estimated_tokens == 0
