"""Per-mode persistence of parsed LLM items."""

from server.domain.analysis_modes import LEADERBOARD_MODE, task_writes_analysis_events
from server.scheduler.result_store.events import store_analysis_events
from server.scheduler.result_store.leaderboard import store_trending_topics

MAX_ITEMS_PER_BATCH = 100

__all__ = ["MAX_ITEMS_PER_BATCH", "store_results"]


async def store_results(
    conn,
    *,
    task: dict,
    batch_id: str,
    items: list[dict],
    channel_names: list[str],
) -> int:
    """Persist items for the task's mode; returns the stored findings count."""
    from server.util import utc_now_iso

    mode = str(task.get("analysis_mode") or "")
    if mode != LEADERBOARD_MODE and not task_writes_analysis_events(task):
        return 0

    task_id = str(task["id"])
    version = int(task.get("version") or 1)
    now = utc_now_iso()
    items = [item for item in items if isinstance(item, dict)][:MAX_ITEMS_PER_BATCH]
    if not items:
        return 0

    if mode == LEADERBOARD_MODE:
        return await store_trending_topics(conn, task_id, version, batch_id, items, now)
    return await store_analysis_events(conn, task_id, version, batch_id, items, channel_names, now)
