"""Source row creation shared by connect and Telegram login."""

from __future__ import annotations

import json
from typing import Any

from server.domain.source_statuses import SOURCE_STATUS_DISCONNECTED
from server.queries import sources_queries
from server.secrets import protect_text
from server.util import new_id, utc_now_iso


async def create_source_row(
    db: Any,
    *,
    platform: str,
    name: str,
    credentials: dict[str, Any],
    status: str = SOURCE_STATUS_DISCONNECTED,
) -> dict[str, Any]:
    source_id = new_id()
    now = utc_now_iso()
    await sources_queries.insert_source(
        db,
        source_id=source_id,
        platform=platform,
        name=name,
        status=status,
        credentials=protect_text(json.dumps(credentials, ensure_ascii=False)),
        now=now,
    )
    row = await sources_queries.fetch_source_row(db, source_id)
    if row is None:
        raise RuntimeError(f"failed to create source {source_id}")
    return row
