"""Unified channel key parsing for routes that reference platform:platformId."""

from __future__ import annotations

from typing import Any, Optional, Union

from fastapi import HTTPException

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
            raise HTTPException(status_code=422, detail=f"Invalid channel key: {token}")
        platform, platform_id = token.split(":", 1)
        if not platform or not platform_id:
            raise HTTPException(status_code=422, detail=f"Invalid channel key: {token}")
        key = (platform, platform_id)
        if key not in seen:
            keys.append(key)
            seen.add(key)
        if len(keys) > max_keys:
            raise HTTPException(
                status_code=422,
                detail=f"A maximum of {max_keys} channels may be requested",
            )
    return keys


def parse_channel_refs(
    channel_ids: Optional[list[Union[str, dict[str, Any]]]],
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
