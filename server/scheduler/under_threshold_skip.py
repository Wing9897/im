"""Observability for under-threshold quiet skips (no batch / no SSE).

Schedule ticks may fire often; stdlib logs every skip, app_logs are debounced
per task so Settings→Logs stays readable.
"""

from __future__ import annotations

import logging
import time

from server.app_logging import record
from server.db.database import Database

logger = logging.getLogger(__name__)

_APP_LOG_DEBOUNCE_S = 60.0
_last_app_log_at: dict[str, float] = {}


async def note_under_threshold_skip(
    db: Database,
    *,
    task_id: str,
    task_name: str,
    message_count: int,
    threshold: int,
    source: str,
) -> None:
    """Log an under-threshold skip; persist to app_logs at most once per minute/task."""
    logger.info(
        "analysis under_threshold skip task=%s count=%s threshold=%s",
        task_id,
        message_count,
        threshold,
    )
    now = time.monotonic()
    last = _last_app_log_at.get(task_id, 0.0)
    if now - last < _APP_LOG_DEBOUNCE_S:
        return
    _last_app_log_at[task_id] = now
    await record(
        db,
        level="info",
        category="analysis",
        kind="analysis.skipped",
        message=(
            f"Analysis skipped (under threshold): {task_name or task_id} "
            f"({message_count}/{threshold})"
        ),
        message_key="logs:templates.analysisSkippedUnderThreshold",
        message_params={
            "taskName": task_name or task_id,
            "messageCount": message_count,
            "threshold": threshold,
        },
        source=source,
        payload={
            "taskId": task_id,
            "taskName": task_name,
            "messageCount": message_count,
            "threshold": threshold,
            "reason": "under_threshold",
        },
    )


def reset_under_threshold_skip_debounce_for_tests() -> None:
    """Clear debounce state between unit tests."""
    _last_app_log_at.clear()
