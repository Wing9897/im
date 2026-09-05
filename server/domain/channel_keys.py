"""Pure ``platform:platformId`` CSV parsing shared by routes and query helpers.

No FastAPI here: callers map :class:`ChannelKeyError` to their own error type
(``server.api.channel_refs`` → HTTP 422, ``queries.messages_queries`` →
``MessagesQueryError``).
"""

from __future__ import annotations

MAX_CHANNEL_KEY_LIST = 100


class ChannelKeyError(ValueError):
    """Malformed or over-long channel key list."""


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
            raise ChannelKeyError(f"Invalid channel key: {token}")
        platform, platform_id = token.split(":", 1)
        if not platform or not platform_id:
            raise ChannelKeyError(f"Invalid channel key: {token}")
        key = (platform, platform_id)
        if key not in seen:
            keys.append(key)
            seen.add(key)
        if len(keys) > max_keys:
            raise ChannelKeyError(f"A maximum of {max_keys} channels may be requested")
    return keys


__all__ = ["MAX_CHANNEL_KEY_LIST", "ChannelKeyError", "parse_channel_key_csv"]
