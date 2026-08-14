"""Unified channel key parsing for routes that reference platform:platformId."""

from __future__ import annotations

from typing import Any

from server.errors import VALIDATION_ERROR, http_error

MAX_CHANNEL_KEY_LIST = 100


def parse_channel_key_csv(
    raw: str,
    *,
    max_keys: int = MAX_CHANNEL_KEY_LIST,
) -> list[tuple[str, str]]:
    """Parse comma-separated ``platform:platformId`` tokens with dedup."""
    keys: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        if ":" not in token:
            raise http_error(422, f"Invalid channel key: {token}", error_code=VALIDATION_ERROR)
        platform, platform_id = token.split(":", 1)
        if not platform or not platform_id:
            raise http_error(422, f"Invalid channel key: {token}", error_code=VALIDATION_ERROR)
        key = (platform, platform_id)
        if key not in seen:
            keys.append(key)
            seen.add(key)
        if len(keys) > max_keys:
            raise http_error(
                422,
                f"A maximum of {max_keys} channels may be requested",
                error_code=VALIDATION_ERROR,
            )
    return keys


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
