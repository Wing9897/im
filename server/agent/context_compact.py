"""Deterministic Agent conversation compaction (no extra LLM call).

Keeps the leading system prompt(s), then the newest dialogue messages that fit
``max_messages`` / ``max_chars``. Older turns are dropped and replaced by a
short omit notice. UI session storage is unchanged — only the model-facing
history is compacted.
"""

from __future__ import annotations

from typing import Any

DEFAULT_MAX_MESSAGES = 40
DEFAULT_MAX_CHARS = 48_000


def _content_len(message: dict[str, Any]) -> int:
    return len(str(message.get("content") or ""))


def compact_agent_history(
    messages: list[dict[str, Any]],
    *,
    max_messages: int = DEFAULT_MAX_MESSAGES,
    max_chars: int = DEFAULT_MAX_CHARS,
    omit_notice: str,
) -> list[dict[str, Any]]:
    """Return a compacted copy of ``messages`` for one LLM request.

    - Leading contiguous ``system`` messages are always kept (not counted
      against ``max_messages``; their chars still count toward ``max_chars``
      reserved after prefix when packing dialogue).
    - Dialogue is packed from the newest message backward.
    - At least the newest dialogue message is kept (content may be truncated
      if a single message exceeds the remaining char budget).
    """
    if not messages:
        return []

    max_messages = max(1, int(max_messages))
    max_chars = max(500, int(max_chars))

    prefix_end = 0
    while prefix_end < len(messages) and str(messages[prefix_end].get("role") or "") == "system":
        prefix_end += 1
    prefix = [dict(m) for m in messages[:prefix_end]]
    dialogue = [dict(m) for m in messages[prefix_end:]]
    if not dialogue:
        return prefix

    prefix_chars = sum(_content_len(m) for m in prefix)
    # Remaining budget for dialogue (+ omit notice). Prefer at least room for
    # the newest message; may be small when the system prompt is large.
    dialogue_budget = max_chars - prefix_chars
    if dialogue_budget < 1:
        dialogue_budget = 1

    kept_rev: list[dict[str, Any]] = []
    used_chars = 0
    for index, msg in enumerate(reversed(dialogue)):
        content = str(msg.get("content") or "")
        remaining_slots = max_messages - len(kept_rev)
        if remaining_slots <= 0:
            break
        # Always take the newest message even if over budget; truncate if needed.
        is_newest = index == 0 and not kept_rev
        if not is_newest and (used_chars + len(content) > dialogue_budget):
            break
        if is_newest and len(content) > dialogue_budget:
            trimmed = content[: dialogue_budget - 1] + "…"
            msg = {**msg, "content": trimmed}
            content = trimmed
        elif not is_newest and used_chars > 0 and used_chars + len(content) > dialogue_budget:
            break
        kept_rev.append(msg)
        used_chars += len(content)

    kept = list(reversed(kept_rev))
    dropped = len(dialogue) - len(kept)
    if dropped <= 0:
        return prefix + kept

    notice = {"role": "user", "content": omit_notice}
    # Re-fit if notice + kept exceeds budget: drop oldest kept until it fits,
    # still keeping the newest message.
    notice_len = len(omit_notice)
    while len(kept) > 1 and notice_len + sum(_content_len(m) for m in kept) > dialogue_budget:
        kept = kept[1:]
    while len(kept) > 1 and len(kept) + 1 > max_messages:
        # notice counts as one dialogue message toward the cap
        kept = kept[1:]
    return prefix + [notice] + kept
