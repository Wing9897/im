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
from server.config import get_config_bool
from server.errors import VALIDATION_ERROR, http_error
from server.queries.batch_stats import count_pending_current_batches
from server.queries.results_queries import (
    fetch_attention_batches,
    fetch_processing_batches,
    fetch_task_analysis_stats,
    fetch_trending_topic_messages,
    fetch_trending_topics,
)
from server.services.analysis_events_read import AnalysisEventsReadError, list_analysis_events
from server.wire.serializer_domains.calendar import serialize_trending_topic
from server.wire.serializer_domains.operations import serialize_queue_batch
from server.wire.serializer_domains.sources import serialize_message

router = APIRouter(prefix="/api/v1/results", tags=["results"], dependencies=API_DEPS)


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
    try:
        page = await list_analysis_events(
            get_db(request),
            task_id=task_id,
            task_ids=task_ids,
            search=search,
            start_date=start_date,
            end_date=end_date,
            sort=sort,
            limit=limit,
            offset=offset,
            has_time=has_time,
            has_coords=has_coords,
            include_total=include_total,
            include_in_timeline=include_in_timeline,
        )
    except AnalysisEventsReadError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc
    return AnalysisEventsPageResponse.model_validate(page)


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
