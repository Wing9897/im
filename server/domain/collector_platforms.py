"""Collector platform vocabulary (Input-layer leaf — safe for DDL import).

``ADAPTER_BUILDERS`` keys and SQLite ``PLATFORM_CHECK_VALUES`` must both
come from here so schema and factory cannot drift.
"""

from __future__ import annotations

from typing import Final, Literal

CollectorPlatform = Literal["telegram", "discord", "rss", "http", "mqtt", "email"]

COLLECTOR_PLATFORMS: Final[tuple[CollectorPlatform, ...]] = (
    "telegram",
    "discord",
    "rss",
    "http",
    "mqtt",
    "email",
)

#: Enriched list payloads (bot／feed／mailbox info). Telegram stays serialize-only.
COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT: Final[frozenset[str]] = frozenset(
    platform for platform in COLLECTOR_PLATFORMS if platform != "telegram"
)
