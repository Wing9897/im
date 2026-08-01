"""Leaderboard cross-batch accumulation (trending_topics, v3 columns)."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from server.db.database import Database
from server.domain.analysis_modes import LEADERBOARD_MODE
from server.util import task_value

MAX_LEADERBOARD_ITEMS = 10


def _serialize_topic_for_prompt(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "topic": row.get("topic_name"),
        "score": row.get("score"),
        "summary": row.get("summary"),
    }


async def load_leaderboard_context(db: Database, task: Mapping[str, Any] | Any) -> list[dict[str, Any]]:
    """Current Top-N board for prompt injection (topic + score only)."""
    mode = task_value(task, "analysis_mode")
    if mode != LEADERBOARD_MODE:
        return []
    task_id = str(task_value(task, "id") or "")
    version = int(task_value(task, "version") or 1)
    rows = await db.fetch_all(
        "SELECT id, rank, topic_name, summary, score, updated_at "
        "FROM trending_topics WHERE task_id = ? AND version = ? AND rank IS NOT NULL "
        "ORDER BY rank ASC, score DESC, id ASC "
        f"LIMIT {MAX_LEADERBOARD_ITEMS}",
        (task_id, version),
    )
    return [_serialize_topic_for_prompt(row) for row in rows]


def _topic_key(entry: Mapping[str, Any]) -> str | None:
    topic = entry.get("topic")
    return None if topic is None else str(topic)


def _score_sort_key(entry: Mapping[str, Any]) -> tuple[float, str]:
    try:
        score = float(entry.get("score") or 0.0)
    except (TypeError, ValueError):
        score = 0.0
    return (-score, str(entry.get("topic") or ""))


def merge_leaderboard(
    existing: Sequence[Mapping[str, Any]],
    updates: Sequence[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """Merge batch scores onto the current board, then rank Top-N by score only.

    - ``existing``: current ranked board (at most MAX_LEADERBOARD_ITEMS)
    - ``updates``: LLM items for this batch (topic + score; rank is ignored)
    - Existing topics not mentioned in ``updates`` keep their prior score
    - Returns the new Top-N with ranks 1..N assigned by score (desc), then topic name
    """
    merged: dict[str, dict[str, Any]] = {}

    for entry in existing:
        key = _topic_key(entry)
        if key is None:
            continue
        merged[key] = {
            "topic": key,
            "score": entry.get("score"),
            "summary": entry.get("summary"),
        }

    for entry in updates:
        key = _topic_key(entry)
        if key is None:
            continue
        if key not in merged:
            merged[key] = {"topic": key, "score": None, "summary": None}
        for field in ("score", "summary"):
            value = entry.get(field)
            if value is not None:
                merged[key][field] = value

    pool = list(merged.values())
    pool.sort(key=_score_sort_key)

    top = pool[:MAX_LEADERBOARD_ITEMS]
    for index, entry in enumerate(top, start=1):
        entry["rank"] = index
    return top
