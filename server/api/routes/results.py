"""Results routes: trending / events / queue / stats.

Result queries always join ``analysis_tasks`` on the task's *current* version,
so results invalidated by a version bump silently disappear from every list.

Calendar time-window reads live under ``GET /api/v1/calendar/window``.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from server.api.deps import API_DEPS, get_db
from server.api.query_aliases import qalias
from server.api.schemas.responses import (
    AnalysisEventsPageResponse,
    MessageResponse,
    ResultsQueueResponse,
    TaskAnalysisStatsResponse,
    TrendingTopicResponse,
)
from server.calendar.timeline_dismissals import attach_dismissed_flag
from server.calendar.timeline_importance import attach_important_flag
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


def _parse_bool_flag(value: str | None) -> bool | None:
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
async def fetch_trending(
    request: Request,
    task_id: str | None = qalias("taskId", default=None),
) -> list[TrendingTopicResponse]:
    rows = await fetch_trending_topics(
        get_db(request),
        task_id=task_id,
    )
    return [TrendingTopicResponse.model_validate(serialize_trending_topic(row)) for row in rows]


@router.get("/trending/{topic_id}/messages", response_model=list[MessageResponse])
async def fetch_topic_messages(request: Request, topic_id: str) -> list[MessageResponse]:
    rows = await fetch_trending_topic_messages(get_db(request), topic_id=topic_id)
    return [MessageResponse.model_validate(serialize_message(row)) for row in rows]


@router.get("/events", response_model=AnalysisEventsPageResponse)
async def fetch_events(
    request: Request,
    task_id: str | None = qalias("taskId", default=None),
    task_ids: list[str] | None = qalias("taskIds", default=None),
    search: str | None = None,
    start_date: str | None = qalias("startDate", default=None),
    end_date: str | None = qalias("endDate", default=None),
    sort: str = "event_time",
    limit: int = 50,
    offset: int = 0,
    has_time: str | None = qalias("hasTime", default=None),
    has_coords: str | None = qalias("hasCoords", default=None),
    include_total: bool | None = qalias("includeTotal", default=None),
    include_in_timeline: str | None = qalias(
        "includeInTimeline",
        default=None,
        description=(
            "When '1'/'true', only return events from tasks with include_in_timeline=1 (time-planning views)."
        ),
    ),
) -> AnalysisEventsPageResponse:
    sort_key = (sort or "event_time").strip().lower()
    if sort_key not in _EVENT_SORTS:
        raise http_error(
            422,
            f"Invalid sort: {sort!r}. Allowed: {', '.join(sorted(_EVENT_SORTS))}",
            error_code=VALIDATION_ERROR,
        )
    normalized_limit, normalized_offset = clamp_offset_limit(limit, offset)
    resolved_include_total = True if include_total is None else bool(include_total)
    # Repeated ``taskIds`` wins over single ``taskId`` when the param is present.
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
        include_total=resolved_include_total,
        require_include_in_timeline=_parse_bool_flag(include_in_timeline) is True,
    )
    items = [serialize_analysis_event(row) for row in rows]
    db = get_db(request)
    await attach_dismissed_flag(db, source="analysis", items=items)
    await attach_important_flag(db, source="analysis", items=items)
    return AnalysisEventsPageResponse.model_validate(
        {
            "items": items,
            "totalCount": total_count if resolved_include_total else 0,
            "hasMore": (
                offset_page_has_more(normalized_offset, len(rows), total_count)
                if resolved_include_total
                else len(rows) >= normalized_limit
            ),
            "sort": sort_key,
        }
    )


@router.get("/queue", response_model=ResultsQueueResponse)
async def fetch_queue(request: Request) -> ResultsQueueResponse:
    db = get_db(request)
    pending = await count_pending_current_batches(db)
    processing = await fetch_processing_batches(db)
    attention = await fetch_attention_batches(db)
    return ResultsQueueResponse.model_validate(
        {
            "pendingCount": pending,
            "processingBatches": [serialize_queue_batch(row) for row in processing],
            "attentionBatches": [serialize_queue_batch(row) for row in attention],
            "analysisPaused": await get_config_bool(db, "analysis_paused"),
        }
    )


@router.get("/stats", response_model=list[TaskAnalysisStatsResponse])
async def fetch_stats(
    request: Request,
    time_range: str | None = qalias("timeRange", default=None),
) -> list[TaskAnalysisStatsResponse]:
    rows = await fetch_task_analysis_stats(get_db(request), time_range=time_range)
    return [TaskAnalysisStatsResponse.model_validate(row) for row in rows]
