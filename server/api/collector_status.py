"""Shared collector status resolution for system and viewer routes."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def resolve_collector_status(collector: Any) -> str:
    """Return the collector status string.

    ``"stopped"`` when no collector exists; ``"error"`` when the status probe
    raises (status endpoints must not fail).
    """
    if collector is None:
        return "stopped"
    try:
        return str(await collector.get_status())
    except Exception:  # noqa: BLE001 — status endpoint must not fail
        logger.exception("Collector status check failed")
        return "error"
