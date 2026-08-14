"""Prompt token-budget estimation and trimming.

The payload walker accumulates an estimated token count per message (in the
given order: overlap context first, then primary messages, both timestamp
ascending) and stops before the first message that would exceed the budget.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from typing import Any, NamedTuple

#: Fallback token budget when the configured value is missing or invalid.
DEFAULT_TOKEN_BUDGET = 30000

_CHARS_PER_TOKEN = 4
_CJK_TOKENS_PER_CHAR = 0.7

_CJK_RANGES: tuple[tuple[int, int], ...] = (
    (0x3040, 0x30FF),  # Hiragana + Katakana
    (0x3400, 0x4DBF),  # CJK Ext A
    (0x4E00, 0x9FFF),  # CJK Unified
    (0xAC00, 0xD7A3),  # Hangul
    (0xF900, 0xFAFF),  # CJK Compatibility
    (0xFF00, 0xFFEF),  # Half/Fullwidth forms
    (0x20000, 0x2A6DF),  # CJK Ext B
)


def _is_cjk(char: str) -> bool:
    code = ord(char)
    return any(low <= code <= high for low, high in _CJK_RANGES)


def estimate_tokens(content: Any) -> int:
    """Cheap heuristic estimate: ~char/4 for ASCII, ~0.7 token per CJK char."""
    if content is None:
        return 0
    text = content if isinstance(content, str) else str(content)
    if not text:
        return 0
    cjk = sum(1 for char in text if _is_cjk(char))
    other = len(text) - cjk
    return math.ceil(other / _CHARS_PER_TOKEN + cjk * _CJK_TOKENS_PER_CHAR)


def _message_content(message: Mapping[str, Any] | Any) -> Any:
    if isinstance(message, Mapping):
        return message.get("content")
    return getattr(message, "content", None)


class TokenBudgetResult(NamedTuple):
    messages: list[Any]
    estimated_tokens: int


def apply_token_budget(
    messages: Iterable[Mapping[str, Any] | Any],
    max_tokens: int,
) -> TokenBudgetResult:
    """Trim ``messages`` to fit the token budget.

    Keeps a prefix of the input, stopping before the first message that would
    exceed the budget. Empty input yields ``([], 0)``.
    """
    kept: list[Any] = []
    total = 0
    for message in messages:
        estimate = estimate_tokens(_message_content(message))
        if total + estimate > max_tokens:
            break
        kept.append(message)
        total += estimate
    return TokenBudgetResult(messages=kept, estimated_tokens=total)
