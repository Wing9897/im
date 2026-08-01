"""Results routes: trending / events / queue / stats.

Result queries always join ``analysis_tasks`` on the task's *current* version,
so results invalidated by a version bump silently disappear from every list.

Calendar occurrences live under ``/api/v1/calendar/items``.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, Request

from server.api.deps import API_DEPS, get_db
from server.api.schemas.responses import (
    AnalysisEventsPageResponse,
    MessageResponse,
    ResultsQueueResponse,
    TaskAnalysisStatsResponse,
    TrendingTopicResponse,
)
from server.calendar.timeline_dismissals import attach_dismissed_flag
from server.config import get_config_bool
from server.errors import VALIDATION_ERROR, http_error
from server.queries.batch_stats import count_pending_current_batches
from server.queries.pagination import clamp_offset_limit, offset_page_has_more
from server.queries.results_queries import (
    fetch_attention_batches,
    fetch_processing_batches,
    fetch_task_analysis_stats,
    fetch_trending_topic_messages,
    fetch_trending_topics,
    query_analysis_events,
)
from server.util import parse_bool
from server.wire.serializers import (
    serialize_analysis_event,
    serialize_message,
    serialize_queue_batch,
    serialize_trending_topic,
)

router = APIRouter(prefix="/api/v1/results", tags=["results"], dependencies=API_DEPS)

_EVENT_SORTS = frozenset({"event_time", "analyzed_at"})
_FALSE_FLAG_VALUES = frozenset({"0", "false", "no", "off"})


def _parse_bool_flag(value: Optional[str]) -> Optional[bool]:
    """Optional query bool: None / True / False; invalid → 422.

    Truthiness delegates to ``util.parse_bool``; explicit false sentinels
    mirror its on/off symmetry (0/false/no/off).
    """
    if value is None:
        return None
    if parse_bool(value):
        return True
    if value.strip().lower() in _FALSE_FLAG_VALUES:
        return False
    raise http_error(422, f"Invalid boolean flag: {value!r}", error_code=VALIDATION_ERROR)


@router.get("/trending", response_model=list[TrendingTopicResponse])
async def fetch_trending(request: Request, task_id: Optional[str] = None) -> list[dict]:
    rows = await fetch_trending_topics(get_db(request), task_id=task_id)
    return [serialize_trending_topic(row) for row in rows]


@router.get("/trending/{topic_id}/messages", response_model=list[MessageResponse])
async def fetch_topic_messages(request: Request, topic_id: str) -> list[dict]:
    rows = await fetch_trending_topic_messages(get_db(request), topic_id=topic_id)
    return [serialize_message(row) for row in rows]


@router.get("/events", response_model=AnalysisEventsPageResponse)
async def fetch_events(
    request: Request,
    task_id: Optional[str] = None,
    task_ids: Optional[list[str]] = Query(default=None),
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort: str = "event_time",
    limit: int = 50,
    offset: int = 0,
    has_time: Optional[str] = None,
    has_coords: Optional[str] = None,
    include_total: bool = True,
    include_in_timeline: Optional[str] = Query(
        default=None,
        description=(
            "When '1'/'true', only return events from tasks with include_in_timeline=1 (time-planning views)."
        ),
    ),
) -> dict:
    sort_key = (sort or "event_time").strip().lower()
    if sort_key not in _EVENT_SORTS:
        raise http_error(
            422,
            f"Invalid sort: {sort!r}. Allowed: {', '.join(sorted(_EVENT_SORTS))}",
            error_code=VALIDATION_ERROR,
        )
    normalized_limit, normalized_offset = clamp_offset_limit(limit, offset)
    # Repeated ``task_ids`` wins over single ``task_id`` when the param is present.
    rows, total_count = await query_analysis_events(
        get_db(request),
        task_id=task_id,
        task_ids=task_ids,
        search=search,
        start_date=start_date,
        end_date=end_date,
        sort=sort_key,
        limit=normalized_limit,
        offset=normalized_offset,
        has_time=_parse_bool_flag(has_time),
        has_coords=_parse_bool_flag(has_coords),
        include_total=include_total,
        require_include_in_timeline=_parse_bool_flag(include_in_timeline) is True,
    )
    items = [serialize_analysis_event(row) for row in rows]
    await attach_dismissed_flag(get_db(request), source="analysis", items=items)
    return {
        "items": items,
        "totalCount": total_count if include_total else 0,
        "hasMore": (
            offset_page_has_more(normalized_offset, len(rows), total_count)
            if include_total
            else len(rows) >= normalized_limit
        ),
        "sort": sort_key,
    }


@router.get("/queue", response_model=ResultsQueueResponse)
async def fetch_queue(request: Request) -> dict:
    db = get_db(request)
    pending = await count_pending_current_batches(db)
    processing = await fetch_processing_batches(db)
    attention = await fetch_attention_batches(db)
    return {
        "pendingCount": pending,
        "processingBatches": [serialize_queue_batch(row) for row in processing],
        "attentionBatches": [serialize_queue_batch(row) for row in attention],
        "analysisPaused": await get_config_bool(db, "analysis_paused"),
    }


@router.get("/stats", response_model=list[TaskAnalysisStatsResponse])
async def fetch_stats(request: Request, time_range: Optional[str] = None) -> list[dict]:
    return await fetch_task_analysis_stats(get_db(request), time_range=time_range)
