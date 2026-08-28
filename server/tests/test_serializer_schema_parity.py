"""Exact serializer-to-Pydantic parity for high-value wire entities."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from pydantic import BaseModel

from server.api.schemas.responses import (
    ActionResponse,
    AnalysisEventResponse,
    AppLogEntryResponse,
    CalendarShareEventResponse,
    CalendarWindowItemResponse,
    ChannelResponse,
    MessageResponse,
    QueueBatchResponse,
    RecurringSeriesResponse,
    SourceResponse,
    TaskResponse,
    TimelineDismissalResponse,
    TimelineImportanceResponse,
    TrendingTopicResponse,
    UserEventResponse,
    WorksetResponse,
)
from server.api.schemas.responses.items import ItemCategoryResponse, ItemResponse
from server.api.schemas.responses.llm_profiles import LlmProfileResponse
from server.wire.serializers import (
    serialize_action,
    serialize_analysis_event,
    serialize_app_log,
    serialize_calendar_share_event,
    serialize_channel,
    serialize_dismissal,
    serialize_importance,
    serialize_item,
    serialize_item_category,
    serialize_llm_profile,
    serialize_message,
    serialize_queue_batch,
    serialize_recurring_series,
    serialize_source,
    serialize_task,
    serialize_trending_topic,
    serialize_user_event,
    serialize_workset,
)

Serializer = Callable[[], dict[str, Any]]


@pytest.mark.parametrize(
    ("entity", "model", "serialize", "model_only_fields"),
    [
        (
            "account",
            SourceResponse,
            lambda: serialize_source(
                {
                    "id": "account-1",
                    "platform": "telegram",
                    "name": "Primary",
                    "status": "connected",
                    "last_error": None,
                    "last_connected_at": "2026-07-28T08:59:00Z",
                    "created_at": "2026-07-28T08:00:00Z",
                    "updated_at": "2026-07-28T08:59:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "action",
            ActionResponse,
            lambda: serialize_action(
                {
                    "id": "action-1",
                    "name": "Notify",
                    "action_type": "http_webhook",
                    "configuration": '{"url":"https://example.com"}',
                    "trigger_conditions": None,
                    "is_enabled": 1,
                    "last_triggered_at": None,
                    "created_at": "2026-07-28T08:00:00Z",
                    "updated_at": "2026-07-28T08:00:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "message",
            MessageResponse,
            lambda: serialize_message(
                {
                    "id": "message-1",
                    "source_id": "account-1",
                    "platform": "telegram",
                    "platform_id": "channel-1",
                    "channel_name": "Announcements",
                    "platform_message_id": "42",
                    "sender_id": "user-1",
                    "sender_name": "Alice",
                    "content": "Hello",
                    "timestamp": "2026-07-28T09:00:00Z",
                    "raw_data": None,
                    "created_at": "2026-07-28T09:00:01Z",
                }
            ),
            frozenset(),
        ),
        (
            "app log",
            AppLogEntryResponse,
            lambda: serialize_app_log(
                {
                    "id": "log-1",
                    "time": "2026-07-28T09:00:00Z",
                    "level": "info",
                    "category": "system",
                    "kind": "system",
                    "message": "Ready",
                    "details": None,
                }
            ),
            frozenset(),
        ),
        (
            "analysis event",
            AnalysisEventResponse,
            lambda: serialize_analysis_event(
                {
                    "id": "event-1",
                    "task_id": "task-1",
                    "version": 2,
                    "batch_id": "batch-1",
                    "title": "Quarterly review",
                    "body": "Review Q3",
                    "start_time": "2026-07-28T09:00:00Z",
                    "end_time": None,
                    "location": "Taipei",
                    "latitude": 25.03,
                    "longitude": 121.56,
                    "participants_json": '["Alice", "Bob"]',
                    "source_message_id": "message-1",
                    "source_platform": "telegram",
                    "source_channel_name": "Announcements",
                    "source_message_time": "2026-07-28T08:55:00Z",
                    "analysis_time_range": "7d",
                    "batch_source_channel_names": '["Announcements"]',
                    "task_name": "Event analysis",
                    "emoji": "🎯",
                    "created_at": "2026-07-28T09:01:00Z",
                    "updated_at": "2026-07-28T09:02:00Z",
                },
                dismissed=True,
            ),
            frozenset(),
        ),
        (
            "trending topic",
            TrendingTopicResponse,
            lambda: serialize_trending_topic(
                {
                    "id": "topic-1",
                    "task_id": "task-1",
                    "batch_id": "batch-1",
                    "rank": 1,
                    "topic_name": "Contract tests",
                    "score": 98.5,
                    "summary": None,
                    "task_name": "Leaderboard",
                    "created_at": "2026-07-28T09:00:00Z",
                    "message_count": 4,
                }
            ),
            frozenset(),
        ),
        (
            "task",
            TaskResponse,
            lambda: serialize_task(
                {
                    "id": "task-1",
                    "name": "Contract task",
                    "description": None,
                    "prompt_template": "Analyze",
                    "analysis_mode": "intel_event",
                    "analysis_time_range": "7d",
                    "version": 3,
                    "is_active": 1,
                    "schedule_rrule": "FREQ=HOURLY",
                    "rrule": None,
                    "event_start_time": None,
                    "event_end_time": None,
                    "event_is_all_day": 0,
                    "event_location": None,
                    "event_description": None,
                    "include_in_timeline": 1,
                    "workset_id": "__general__",
                    "llm_profile_id": "profile-default",
                    "agent_wave_interval_seconds": None,
                    "batch_overlap_count": None,
                    "analysis_trigger_threshold": None,
                    "analysis_batch_message_limit": None,
                    "analysis_strategy_mode": None,
                    "emoji": None,
                    "created_at": "2026-07-28T09:00:00Z",
                    "updated_at": "2026-07-28T09:00:00Z",
                },
                [{"id": "telegram:news", "platform": "telegram", "platformId": "news"}],
            ),
            frozenset({"deletedBatchCount"}),
        ),
        (
            "workset",
            WorksetResponse,
            lambda: serialize_workset(
                {
                    "id": "workset-1",
                    "name": "Research",
                    "is_system": 0,
                    "description": "Desk research",
                    "cover_data_url": "data:image/jpeg;base64,x",
                    "created_at": "2026-07-28T09:00:00Z",
                    "updated_at": "2026-07-28T09:01:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "item category",
            ItemCategoryResponse,
            lambda: serialize_item_category(
                {
                    "id": "category-1",
                    "name": "Subscription",
                    "slug": "subscription",
                    "sort_order": 2,
                    "color": "#112233",
                    "emoji": "📦",
                    "default_remind_before_days": 7,
                    "created_at": "2026-07-28T09:00:00Z",
                    "updated_at": "2026-07-28T09:01:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "item",
            ItemResponse,
            lambda: serialize_item(
                {
                    "id": "item-1",
                    "title": "Cursor",
                    "category_id": "category-1",
                    "workset_id": "workset-1",
                    "notes": "Renew annually",
                    "status": "active",
                    "emoji": "🧠",
                    "quantity": 2.5,
                    "unit": "kg",
                    "created_at": "2026-07-28T09:00:00Z",
                    "updated_at": "2026-07-28T09:01:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "recurring series",
            RecurringSeriesResponse,
            lambda: serialize_recurring_series(
                {
                    "id": "series-recurring",
                    "name": "Weekly review",
                    "description": "Weekly review",
                    "rrule": "FREQ=WEEKLY;BYDAY=MO",
                    "event_start_time": "2026-07-28T09:00:00",
                    "event_end_time": "2026-07-28T10:00:00",
                    "event_is_all_day": 0,
                    "event_location": "Taipei",
                    "event_description": "Weekly review",
                    "event_timezone": "floating",
                    "event_start_local": None,
                    "event_end_local": None,
                    "event_exdates_json": "[]",
                    "event_rdates_json": "[]",
                    "ics_uid": None,
                    "ics_source": None,
                    "is_active": 1,
                    "workset_id": "__general__",
                    "parent_task_id": None,
                    "item_id": None,
                    "emoji": "🔁",
                    "created_at": "2026-07-28T08:00:00Z",
                    "updated_at": "2026-07-28T08:00:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "queue batch",
            QueueBatchResponse,
            lambda: serialize_queue_batch(
                {
                    "id": "batch-1",
                    "task_id": "task-1",
                    "task_name": "Queue task",
                    "message_count": 12,
                    "status": "pending",
                    "retry_count": 1,
                    "error_message": None,
                    "prompt_tokens": 40,
                    "completion_tokens": 10,
                    "created_at": "2026-07-28T09:00:00Z",
                    "updated_at": "2026-07-28T09:01:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "timeline dismissal",
            TimelineDismissalResponse,
            lambda: serialize_dismissal(
                {
                    "source": "user",
                    "event_id": "ue-1",
                    "dismissed_at": "2026-07-28T09:00:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "timeline importance",
            TimelineImportanceResponse,
            lambda: serialize_importance(
                {
                    "source": "analysis",
                    "event_id": "ev-1",
                    "marked_at": "2026-07-28T09:00:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "user event",
            UserEventResponse,
            lambda: serialize_user_event(
                {
                    "id": "user-event-1",
                    "title": "Agent-created event",
                    "body": "",
                    "start_time": "2026-07-28T10:00:00Z",
                    "end_time": None,
                    "location": "",
                    "origin": "a2a",
                    "task_id": None,
                    "workset_id": "__general__",
                    "emoji": "🎂",
                    "created_at": "2026-07-28T09:00:00Z",
                    "updated_at": "2026-07-28T09:00:00Z",
                },
                dismissed=False,
            ),
            frozenset(),
        ),
        (
            "project user event",
            UserEventResponse,
            lambda: serialize_user_event(
                {
                    "id": "user-event-project",
                    "title": "Project tick event",
                    "body": "",
                    "start_time": "2026-07-28T11:00:00Z",
                    "end_time": None,
                    "location": "",
                    "origin": "agent",
                    "task_id": "proj-1",
                    "workset_id": None,
                    "emoji": None,
                    "created_at": "2026-07-28T09:00:00Z",
                    "updated_at": "2026-07-28T09:00:00Z",
                },
                dismissed=False,
            ),
            frozenset(),
        ),
        (
            "llm profile",
            LlmProfileResponse,
            lambda: serialize_llm_profile(
                {
                    "id": "profile-1",
                    "name": "Local",
                    "provider": "ollama",
                    "base_url": "http://localhost:11434",
                    "model": "llama",
                    "api_key": "",
                    "thinking_enabled": 0,
                    "json_mode": "disabled",
                    "web_search_enabled": 1,
                    "web_search_provider": "auto",
                    "brave_search_api_key": "",
                    "tavily_search_api_key": "",
                    "perplexity_search_api_key": "",
                    "serper_search_api_key": "",
                    "created_at": "2026-07-28T09:00:00Z",
                    "updated_at": "2026-07-28T09:00:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "channel",
            ChannelResponse,
            lambda: serialize_channel(
                {
                    "platform": "telegram",
                    "platform_id": "news",
                    "channel_name": "Announcements",
                    "created_at": "2026-07-28T09:00:00Z",
                }
            ),
            frozenset(),
        ),
        (
            "calendar window item",
            CalendarWindowItemResponse,
            lambda: {
                "id": "evt-1",
                "source": "analysis",
                "title": "Quarterly review",
                "startTime": "2026-07-28T09:00:00Z",
                "endTime": None,
                "location": "Taipei",
                "isAllDay": False,
                "timezone": None,
                "emoji": None,
                "taskId": "task-1",
                "seriesId": None,
                "worksetId": None,
                "itemId": None,
                "origin": None,
                "itemDateKind": None,
                "notifyPref": None,
                "dismissed": False,
                "important": False,
                "taskName": "Event analysis",
                "isLastOccurrence": False,
                "remindBeforeDays": None,
                "body": "Review Q3",
            },
            frozenset(),
        ),
        (
            "calendar share event",
            CalendarShareEventResponse,
            lambda: serialize_calendar_share_event(
                event_id="Alice/Work:evt-1",
                source="subscribed:Alice/Work",
                title="Busy",
                start_time="2026-08-01T09:00:00Z",
                end_time="2026-08-01T10:00:00Z",
                task_name="Alice/Work",
                handle="Alice",
                slug="Work",
            ),
            frozenset(),
        ),
    ],
)
def test_serializer_matches_response_model_exactly(
    entity: str,
    model: type[BaseModel],
    serialize: Serializer,
    model_only_fields: frozenset[str],
) -> None:
    payload = serialize()
    assert set(payload) == set(model.model_fields) - model_only_fields, entity

    validated = model.model_validate(payload)
    assert validated.model_dump(exclude=set(model_only_fields)) == payload
