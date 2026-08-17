"""Prompt assembly: template + leaderboard context + strict-JSON instruction.

Pure and synchronous — operates on already-fetched message dicts.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from server.analyzer.token_budget import apply_token_budget, estimate_tokens
from server.domain.analysis_modes import LEADERBOARD_MODE
from server.prompts import (
    EVENT_SCHEMA_INSTRUCTION,
    JSON_OUTPUT_PREAMBLE,
    LEADERBOARD_CONTEXT_HEADER,
    LEADERBOARD_SCHEMA_INSTRUCTION,
    STRATEGY_INSTRUCTIONS,
)
from server.prompts.clock import ANALYSIS_CLOCK_NOTE, current_time_prompt_block
from server.prompts.locale import normalize_ui_locale, output_language_directive


def build_json_instruction(analysis_mode: str) -> str:
    """Mode-specific strict-JSON output instruction."""
    schema = LEADERBOARD_SCHEMA_INSTRUCTION if analysis_mode == LEADERBOARD_MODE else EVENT_SCHEMA_INSTRUCTION
    return JSON_OUTPUT_PREAMBLE + schema


def _message_id(message: Mapping[str, Any] | Any) -> Any:
    if isinstance(message, Mapping):
        return message.get("message_id") or message.get("id")
    return getattr(message, "message_id", None) or getattr(message, "id", None)


def _message_field(message: Mapping[str, Any] | Any, key: str) -> Any:
    if isinstance(message, Mapping):
        return message.get(key)
    return getattr(message, key, None)


def format_messages(messages: Sequence[Mapping[str, Any] | Any]) -> str:
    """Render messages as ``[id=...][time=...][sender] content`` lines."""
    lines: list[str] = []
    for m in messages:
        message_id = _message_id(m)
        prefix = f"[id={message_id}]" if message_id else ""
        timestamp = str(_message_field(m, "timestamp") or "").strip()
        time_part = f"[time={timestamp}]" if timestamp else ""
        sender = _message_field(m, "sender_name") or ""
        content = _message_field(m, "content") or ""
        lines.append(f"{prefix}{time_part}[{sender}] {content}")
    return "\n".join(lines)


def build_leaderboard_context_block(
    leaderboard_context: Sequence[Mapping[str, Any]] | None,
) -> str:
    """Serialize the existing board as a JSON context block ([] when empty)."""
    rows = list(leaderboard_context) if leaderboard_context else []
    serialized = json.dumps(rows, ensure_ascii=False, sort_keys=True)
    return f"\n\n---\n{LEADERBOARD_CONTEXT_HEADER}\n{serialized}\n"


@dataclass
class AssembledPrompt:
    """Assembled LLM messages plus overlap/token statistics for SSE."""

    llm_messages: list[dict[str, str]]
    system_prompt: str
    user_content: str
    analysis_mode: str
    estimated_tokens: int
    overlap_used_count: int
    overlap_trimmed_count: int
    primary_used_count: int
    overlap_tokens: int
    primary_tokens: int
    kept_messages: list[Any] = field(default_factory=list)

    @property
    def overlap_statistics(self) -> dict[str, int]:
        return {
            "overlapUsedCount": self.overlap_used_count,
            "overlapTrimmedCount": self.overlap_trimmed_count,
            "overlapTokens": self.overlap_tokens,
            "primaryTokens": self.primary_tokens,
            "totalTokens": self.estimated_tokens,
        }


def build_analysis_prompt(
    *,
    prompt_template: str,
    analysis_mode: str,
    primary_messages: Sequence[Mapping[str, Any] | Any],
    overlap_messages: Sequence[Mapping[str, Any] | Any] | None = None,
    leaderboard_context: Sequence[Mapping[str, Any]] | None = None,
    max_tokens: int,
    max_total_chars: int | None = None,
    strategy_mode: str | None = None,
    ui_locale: str | None = None,
    now: datetime | None = None,
    output_analysis_events: bool = True,
) -> AssembledPrompt:
    """Assemble the final LLM prompt under the token/char budgets.

    Overlap messages come first (they are the older tail of the previous
    batch), then primary messages; the token budget keeps a prefix of that
    combined order, so trimming drops the newest primary messages first.
    """
    overlap = list(overlap_messages) if overlap_messages else []
    primary = list(primary_messages) if primary_messages else []
    overlap_count = len(overlap)

    combined = overlap + primary

    # Optional total-char pre-budget (analysis_max_total_chars).
    if max_total_chars is not None and max_total_chars > 0:
        pre_kept: list[Any] = []
        remaining = max_total_chars
        for m in combined:
            content = str(_message_field(m, "content") or "")
            if remaining <= 0:
                break
            if len(content) > remaining:
                trimmed = dict(m) if isinstance(m, Mapping) else m
                if isinstance(trimmed, dict):
                    trimmed["content"] = content[:remaining]
                    pre_kept.append(trimmed)
                remaining = 0
                break
            pre_kept.append(m)
            remaining -= len(content)
        combined = pre_kept

    kept, estimated_tokens = apply_token_budget(combined, max_tokens)

    overlap_used_count = min(len(kept), overlap_count)
    primary_used_count = len(kept) - overlap_used_count
    overlap_trimmed_count = overlap_count - overlap_used_count

    kept_overlap = kept[:overlap_used_count]
    overlap_tokens = sum(estimate_tokens(_message_field(m, "content")) for m in kept_overlap)
    primary_tokens = estimated_tokens - overlap_tokens

    user_content = format_messages(kept)

    system_prompt = prompt_template
    system_prompt += current_time_prompt_block(now, authority_note=ANALYSIS_CLOCK_NOTE)
    if strategy_mode:
        system_prompt += STRATEGY_INSTRUCTIONS.get(strategy_mode, "")
    if analysis_mode == LEADERBOARD_MODE:
        system_prompt += build_leaderboard_context_block(leaderboard_context)
    if output_analysis_events:
        system_prompt += build_json_instruction(analysis_mode)
    system_prompt += "\n\n" + output_language_directive(normalize_ui_locale(ui_locale))

    return AssembledPrompt(
        llm_messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        system_prompt=system_prompt,
        user_content=user_content,
        analysis_mode=analysis_mode,
        estimated_tokens=estimated_tokens,
        overlap_used_count=overlap_used_count,
        overlap_trimmed_count=overlap_trimmed_count,
        primary_used_count=primary_used_count,
        overlap_tokens=overlap_tokens,
        primary_tokens=primary_tokens,
        kept_messages=kept,
    )
