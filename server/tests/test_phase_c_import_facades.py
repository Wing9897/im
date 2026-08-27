"""Public-import compatibility for Phase C file splits."""

from __future__ import annotations

from server.agent.runtime import MAX_TOOL_ROUNDS, AgentRuntime, LlmCompleter, build_system_prompt
from server.analyzer.llm_providers import (
    GEMINI_MAX_TOKENS_MESSAGE,
    GEMINI_THINKING_LEVEL_MINIMAL,
    LLM_RESPONSE_BODY_CAP,
    LlmClientError,
    check_response,
    complete_gemini,
    complete_ollama,
    complete_openai_responses_web_search,
    complete_openai_style,
    convert_messages_to_gemini,
    extract_gemini_text,
    extract_openai_responses_text,
    gemini_thinking_config,
    probe_gemini,
    probe_ollama,
    probe_openai_style,
)
from server.api.schemas.responses import (
    ActionResponse,
    AgentChatResponse,
    AnalysisEventResponse,
    CalendarSharePublishStateResponse,
    FocalBackgroundResponse,
    HealthResponse,
    MessageResponse,
    SystemSettingsSnapshot,
    TaskResponse,
    UserEventResponse,
    WorksetResponse,
)
from server.api.schemas.responses.items import ItemCategoryResponse
from server.queries.items_queries import (
    delete_category,
    delete_item,
    fetch_active_items_with_dates,
    fetch_all_category_rows,
    fetch_category_by_slug,
    fetch_category_row,
    fetch_expiring_items,
    fetch_item_row,
    fetch_item_rows,
    insert_category,
    insert_item,
    sync_linked_calendars_workset,
    update_category,
    update_item,
)

# Names that the responses barrel exported before the Phase C thin.
_RESPONSES_BARREL_REQUIRED = frozenset(
    {
        "AccessKeyCreatedResponse",
        "AccessKeyDeleteResponse",
        "AccessKeyListResponse",
        "AccessKeyPublicResponse",
        "ActionResponse",
        "ActionTestResponse",
        "ActionToggleResponse",
        "ActionTriggerHistoryEntryResponse",
        "ActionTriggerHistoryPageResponse",
        "AddDiscordBotResponse",
        "AddEmailMailboxResponse",
        "AddHttpSourceResponse",
        "AddMqttBrokerResponse",
        "AddRssFeedResponse",
        "AddSourceResponse",
        "AgentChatResponse",
        "AgentTickInFlightResponse",
        "AgentTickLogEntryResponse",
        "AgentTickStatusResponse",
        "AgentToolCallSummary",
        "AiEngineHealthStatusResponse",
        "AiEngineTestResultResponse",
        "AnalysisAbortResponse",
        "AnalysisEventResponse",
        "AnalysisEventsPageResponse",
        "AnalysisPauseResponse",
        "AppLogCursorResponse",
        "AppLogEntryResponse",
        "AppLogPageResponse",
        "AssistantSessionSchema",
        "AssistantSessionsPutBody",
        "AssistantSessionsResponse",
        "AssistantVoiceIoBody",
        "AssistantVoiceIoResponse",
        "AssistantVoiceIoSettingsSchema",
        "BoardLayoutSchema",
        "BoardPrefsPutBody",
        "BoardPrefsResponse",
        "BoardWidgetStateSchema",
        "CalendarHolidayItemResponse",
        "CalendarHolidaysResponse",
        "CalendarImportChangeResponse",
        "CalendarImportCommitItemResponse",
        "CalendarImportCommitResponse",
        "CalendarImportPreviewItemResponse",
        "CalendarImportPreviewResponse",
        "CalendarImportWarningResponse",
        "CalendarShareEventResponse",
        "CalendarShareGrantResponse",
        "CalendarSharePublishStateResponse",
        "CalendarShareSearchHitResponse",
        "CalendarShareSearchResponse",
        "CalendarShareSessionResponse",
        "CalendarShareSubscriptionEventsResponse",
        "CalendarShareSubscriptionResponse",
        "CalendarShareSubscriptionsResponse",
        "CalendarShareTimezoneResponse",
        "CalendarWindowItemResponse",
        "CalendarWindowResponse",
        "ChannelRefResponse",
        "ChannelResponse",
        "ChannelWithSourceResponse",
        "CollectorAdapterStatusResponse",
        "CollectorRestartResponse",
        "CollectorStatusResponse",
        "DeviceInfoResponse",
        "DeviceListEntryResponse",
        "DeviceListResponse",
        "DeviceSessionTokensResponse",
        "DiscordBotInfoResponse",
        "DiscordChannelInfoResponse",
        "DiscordSubscribeResponse",
        "EmailMailboxInfoResponse",
        "FocalBackgroundResponse",
        "HealthResponse",
        "HttpSourceInfoResponse",
        "MessageCursorResponse",
        "MessageMediaResponse",
        "MessageResponse",
        "MessagesIngestBatchResponse",
        "MessagesPageResponse",
        "MqttBrokerInfoResponse",
        "NotifyFiredBody",
        "NotifyFiredClaimResponse",
        "NotifyFiredResponse",
        "NotifyHistoryBody",
        "NotifyHistoryEntrySchema",
        "NotifyHistoryResponse",
        "NotifySettingsBody",
        "NotifySettingsResponse",
        "NotifySettingsSchema",
        "QueueBatchResponse",
        "RecurringSeriesPageResponse",
        "RecurringSeriesResponse",
        "RefreshAllSourcesResponse",
        "ResultsQueueResponse",
        "RetentionDeletedCounts",
        "RetentionRunResponse",
        "RotateSecretsResponse",
        "RotateSecretsScrubbedCounts",
        "RssFeedInfoResponse",
        "SetupOkResponse",
        "SetupStatusResponse",
        "SourceFilterSelectionSchema",
        "SourceResponse",
        "SseAnalysisCompletedPayload",
        "SseAnalysisFailedPayload",
        "SseAnalysisPausedChangedPayload",
        "SseAnalysisStartedPayload",
        "SseCollectorStatusChangedPayload",
        "SseEventEnvelope",
        "SseMessagesUpdatedPayload",
        "SseOverlapStatistics",
        "SseResourceModifiedPayload",
        "SseSourceStatusChangedPayload",
        "SystemMessageResponse",
        "SystemSettingsSnapshot",
        "TaskActivitySpanResponse",
        "TaskAnalysisStatsResponse",
        "TaskDeleteResponse",
        "TaskDraftPayload",
        "TaskResponse",
        "TaskTemplateResponse",
        "TimelineAnnotationsPutBody",
        "TimelineAnnotationsResponse",
        "TimelineDismissalResponse",
        "TimelineImportanceResponse",
        "TrendingTopicResponse",
        "UpdateTelegramSourceResponse",
        "UserEventResponse",
        "UserEventsPageResponse",
        "ViewerStatsResponse",
        "ViewerStatusResponse",
        "ViewerTaskResponse",
        "WeatherDailyResponse",
        "WeatherForecastResponse",
        "WorksetDeleteResponse",
        "WorksetResponse",
    }
)


def test_agent_runtime_facade_exports() -> None:
    assert MAX_TOOL_ROUNDS == 8
    assert AgentRuntime.__name__ == "AgentRuntime"
    assert LlmCompleter.__name__ == "LlmCompleter"
    assert callable(build_system_prompt)


def test_llm_providers_facade_exports() -> None:
    assert LLM_RESPONSE_BODY_CAP == 4000
    assert GEMINI_THINKING_LEVEL_MINIMAL == "MINIMAL"
    assert "MAX_TOKENS" in GEMINI_MAX_TOKENS_MESSAGE
    assert issubclass(LlmClientError, Exception)
    for fn in (
        check_response,
        complete_gemini,
        complete_ollama,
        complete_openai_responses_web_search,
        complete_openai_style,
        convert_messages_to_gemini,
        extract_gemini_text,
        extract_openai_responses_text,
        gemini_thinking_config,
        probe_gemini,
        probe_ollama,
        probe_openai_style,
    ):
        assert callable(fn)


def test_items_queries_facade_exports() -> None:
    for fn in (
        delete_category,
        delete_item,
        fetch_active_items_with_dates,
        fetch_all_category_rows,
        fetch_category_by_slug,
        fetch_category_row,
        fetch_expiring_items,
        fetch_item_row,
        fetch_item_rows,
        insert_category,
        insert_item,
        sync_linked_calendars_workset,
        update_category,
        update_item,
    ):
        assert callable(fn)


def test_responses_barrel_keeps_previous_public_names() -> None:
    from server.api.schemas.responses import __all__ as exported

    missing = sorted(_RESPONSES_BARREL_REQUIRED - set(exported))
    assert missing == []


def test_responses_barrel_representative_models() -> None:
    assert ActionResponse.__name__ == "ActionResponse"
    assert AgentChatResponse.__name__ == "AgentChatResponse"
    assert AnalysisEventResponse.__name__ == "AnalysisEventResponse"
    assert CalendarSharePublishStateResponse.__name__ == "CalendarSharePublishStateResponse"
    assert FocalBackgroundResponse.__name__ == "FocalBackgroundResponse"
    assert HealthResponse.__name__ == "HealthResponse"
    assert MessageResponse.__name__ == "MessageResponse"
    assert SystemSettingsSnapshot.__name__ == "SystemSettingsSnapshot"
    assert TaskResponse.__name__ == "TaskResponse"
    assert UserEventResponse.__name__ == "UserEventResponse"
    assert WorksetResponse.__name__ == "WorksetResponse"
    # items.py stays a direct import (never on the barrel).
    assert ItemCategoryResponse.__name__ == "ItemCategoryResponse"
