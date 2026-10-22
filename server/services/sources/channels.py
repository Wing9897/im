"""Source-channel listings used by presenters and routes."""

from __future__ import annotations

from typing import Any

from server.queries import sources_queries
from server.wire.serializer_domains.sources import serialize_channel


async def list_source_channels(db: Any, source_id: str, platform: str) -> list[dict[str, Any]]:
    rows = await sources_queries.fetch_source_channel_rows(db, source_id, platform)
    return [serialize_channel(row) for row in rows]


async def list_source_channels_batch(
    db: Any,
    source_ids: list[str],
    platform: str,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch channels for many sources in one query (empty lists for sources with no links)."""
    if not source_ids:
        return {}
    rows = await sources_queries.fetch_source_channel_rows_batch(db, source_ids, platform)
    grouped: dict[str, list[dict[str, Any]]] = {source_id: [] for source_id in source_ids}
    for row in rows:
        source_id = str(row["source_id"])
        channel = {key: value for key, value in row.items() if key != "source_id"}
        grouped.setdefault(source_id, []).append(serialize_channel(channel))
    return grouped
