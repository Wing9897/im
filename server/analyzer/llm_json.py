"""Parsing helpers for LLM JSON replies (markdown/prose tolerant)."""

from __future__ import annotations

import json
import re

#: Markdown ```json ... ``` (or bare ```) fence; group 1 is the fenced body.
JSON_FENCE_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)

#: Closed reasoning blocks emitted by Ollama thinking models (think=false leak path).
_THINK_TAG = "<" + "think>"
_THINK_CLOSE = "</" + "think>"
_CLOSED_THINKING_RE = re.compile(
    re.escape(_THINK_TAG) + r".*?" + re.escape(_THINK_CLOSE) + r"|"
    r"<think>.*?</think>",
    re.DOTALL | re.IGNORECASE,
)
_THINKING_PREFIXES = ("<think>", _THINK_TAG)


def strip_reasoning_preamble(text: str) -> str:
    """Drop thinking traces that leaked into ``message.content`` before JSON parse."""
    cleaned = _CLOSED_THINKING_RE.sub("", text).strip()
    lower = cleaned.lower()
    if lower.startswith(_THINKING_PREFIXES):
        for opener in ("{", "["):
            pos = cleaned.find(opener)
            if pos != -1:
                return cleaned[pos:].strip()
    return cleaned


def extract_json_from_markdown(text: str) -> str | None:
    """Extract JSON from a ```json ... ``` (or bare ```) fence, if present."""
    match = JSON_FENCE_RE.search(text)
    if match:
        return match.group(1).strip()
    return None


def parse_json_response(text: str) -> dict | list:
    """Parse an LLM reply as JSON, tolerating markdown/prose wrapping."""
    text = strip_reasoning_preamble(text)
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass

    extracted = extract_json_from_markdown(text)
    if extracted is not None:
        try:
            return json.loads(extracted)
        except (json.JSONDecodeError, TypeError):
            pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except (json.JSONDecodeError, TypeError):
            pass

    raise ValueError(f"Failed to parse LLM response as JSON: {text[:200]}")


def normalize_items(parsed: dict | list) -> list:
    """Normalize a parsed reply into a list of item dicts."""
    if isinstance(parsed, dict) and "items" in parsed:
        items = parsed["items"]
        return items if isinstance(items, list) else [items]
    if isinstance(parsed, list):
        return parsed
    return [parsed]
