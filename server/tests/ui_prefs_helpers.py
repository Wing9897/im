"""Shared helpers for ui-prefs tests."""

from __future__ import annotations

from typing import Optional

from server.db.database import Database


async def ui_pref_payload(db: Database, key: str) -> Optional[str]:
    return await db.fetch_value("SELECT payload_json FROM ui_prefs WHERE key = ?", (key,))
