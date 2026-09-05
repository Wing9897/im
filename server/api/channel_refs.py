"""Unified channel key parsing for routes that reference platform:platformId."""

from __future__ import annotations

from typing import Any

from server.domain.channel_keys import MAX_CHANNEL_KEY_LIST, ChannelKeyError
from server.domain.channel_keys import parse_channel_key_csv as _parse_channel_key_csv
from server.errors import VALIDATION_ERROR, http_error

__all__ = ["MAX_CHANNEL_KEY_LIST", "parse_channel_key_csv", "parse_channel_refs"]


def parse_channel_key_csv(
    raw: str,
    *,
    max_keys: int = MAX_CHANNEL_KEY_LIST,
) -> list[tuple[str, str]]:
    """HTTP boundary: parse ``platform:platformId`` CSV, mapping errors to 422."""
    try:
        return _parse_channel_key_csv(raw, max_keys=max_keys)
    except ChannelKeyError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc


def parse_channel_refs(
    channel_ids: list[str | dict[str, Any]] | None,
) -> list[tuple[str, str]]:
    """Accepts ``platform:platformId`` strings or ChannelRef objects."""
    refs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for entry in channel_ids or []:
        if isinstance(entry, str):
            if ":" not in entry:
                continue
            platform, platform_id = entry.split(":", 1)
        else:
            platform = str(entry.get("platform") or "")
            platform_id = str(entry.get("platformId") or entry.get("platform_id") or "")
        if not platform or not platform_id:
            continue
        key = (platform, platform_id)
        if key not in seen:
            seen.add(key)
            refs.append(key)
    return refs
