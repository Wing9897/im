"""Response models for drift-prone API routes (camelCase wire format).

Grouped by domain in the sibling modules; routes and tests import them from
this package, so a model can move between modules without touching callers.
"""

from __future__ import annotations

from server.api.schemas.responses.actions import (
    ActionResponse,
    ActionTestResponse,
    ActionToggleResponse,
    ActionTriggerHistoryEntryResponse,
    ActionTriggerHistoryPageResponse,
)
from server.api.schemas.responses.auth import (
    AccessKeyCreatedResponse,
    AccessKeyDeleteResponse,
    AccessKeyListResponse,
    AccessKeyPublicResponse,
    DeviceInfoResponse,
    DeviceListEntryResponse,
    DeviceListResponse,
    DeviceSessionTokensResponse,
    SetupOkResponse,
    SetupStatusResponse,
)
from server.api.schemas.responses.calendar_share import (
    CalendarShareEventResponse,
    CalendarShareGrantResponse,
    CalendarShareProfileResponse,
    CalendarSharePublishListItemResponse,
    CalendarSharePublishListResponse,
    CalendarSharePublishStateResponse,
    CalendarShareSearchHitResponse,
    CalendarShareSearchResponse,
    CalendarShareSessionResponse,
    CalendarShareSubscriptionEventsResponse,
    CalendarShareSubscriptionResponse,
    CalendarShareSubscriptionsResponse,
    CalendarShareTimezoneResponse,
)
from server.api.schemas.responses.events import (
    AnalysisEventResponse,
    AnalysisEventsPageResponse,
    CalendarHolidayItemResponse,
    CalendarHolidaysResponse,
    CalendarImportChangeResponse,
    CalendarImportCommitItemResponse,
    CalendarImportCommitResponse,
    CalendarImportPreviewItemResponse,
    CalendarImportPreviewResponse,
    CalendarImportWarningResponse,
    CalendarWindowItemResponse,
    CalendarWindowResponse,
    RecurringSeriesPageResponse,
    RecurringSeriesResponse,
    TimelineDismissalResponse,
    TimelineImportanceResponse,
    TrendingTopicResponse,
    UserEventResponse,
    UserEventsPageResponse,
)
from server.api.schemas.responses.logs import (
    AppLogCursorResponse,
    AppLogEntryResponse,
    AppLogPageResponse,
)
from server.api.schemas.responses.messages import (
    ChannelResponse,
    ChannelWithSourceResponse,
    MessageCursorResponse,
    MessageMediaResponse,
    MessageResponse,
    MessagesIngestBatchResponse,
    MessagesPageResponse,
)
from server.api.schemas.responses.sources import (
    AddDiscordBotResponse,
    AddEmailMailboxResponse,
    AddHttpSourceResponse,
    AddMqttBrokerResponse,
    AddRssFeedResponse,
    AddSourceResponse,
    DiscordBotInfoResponse,
    DiscordChannelInfoResponse,
    DiscordSubscribeResponse,
    EmailMailboxInfoResponse,
    HttpSourceInfoResponse,
    MqttBrokerInfoResponse,
    RefreshAllSourcesResponse,
    RssFeedInfoResponse,
    SourceResponse,
    UpdateTelegramSourceResponse,
)
from server.api.schemas.responses.sse import (
    SseAnalysisCompletedPayload,
    SseAnalysisFailedPayload,
    SseAnalysisPausedChangedPayload,
    SseAnalysisStartedPayload,
    SseCollectorStatusChangedPayload,
    SseEventEnvelope,
    SseMessagesUpdatedPayload,
    SseOverlapStatistics,
    SseResourceModifiedPayload,
    SseSourceStatusChangedPayload,
)
from server.api.schemas.responses.system import (
    AiEngineHealthStatusResponse,
    AiEngineTestResultResponse,
    AnalysisAbortResponse,
    AnalysisPauseResponse,
    CollectorAdapterStatusResponse,
    CollectorRestartResponse,
    CollectorStatusResponse,
    HealthResponse,
    RetentionDeletedCounts,
    RetentionRunResponse,
    RotateSecretsResponse,
    RotateSecretsScrubbedCounts,
    SystemMessageResponse,
    SystemSettingsSnapshot,
)
from server.api.schemas.responses.agents import (
    AgentStreamErrorEvent,
    AgentStreamFinalEvent,
    AgentStreamLlmStartEvent,
    AgentStreamToolDoneEvent,
    AgentStreamToolStartEvent,
)
from server.api.schemas.responses.tasks import (
    AgentChatResponse,
    AgentTickInFlightResponse,
    AgentTickLogEntryResponse,
    AgentTickStatusResponse,
    AgentToolCallSummary,
    ChannelRefResponse,
    QueueBatchResponse,
    ResultsQueueResponse,
    TaskActivitySpanResponse,
    TaskAnalysisStatsResponse,
    TaskDeleteResponse,
    TaskDraftPayload,
    TaskResponse,
    TaskTemplateResponse,
)
from server.api.schemas.responses.theme import FocalBackgroundResponse
from server.api.schemas.responses.ui_prefs import (
    AssistantSessionSchema,
    AssistantSessionsPutBody,
    AssistantSessionsResponse,
    AssistantVoiceIoBody,
    AssistantVoiceIoResponse,
    AssistantVoiceIoSettingsSchema,
    BoardLayoutSchema,
    BoardPrefsPutBody,
    BoardPrefsResponse,
    BoardWidgetStateSchema,
    NotifyFiredBody,
    NotifyFiredClaimResponse,
    NotifyFiredResponse,
    NotifyHistoryBody,
    NotifyHistoryEntrySchema,
    NotifyHistoryResponse,
    NotifySettingsBody,
    NotifySettingsResponse,
    NotifySettingsSchema,
    SourceFilterSelectionSchema,
    TimelineAnnotationsPutBody,
    TimelineAnnotationsResponse,
)
from server.api.schemas.responses.viewer import (
    ViewerStatsResponse,
    ViewerStatusResponse,
    ViewerTaskResponse,
)
from server.api.schemas.responses.weather import (
    WeatherDailyResponse,
    WeatherForecastResponse,
)
from server.api.schemas.responses.worksets import WorksetDeleteResponse, WorksetResponse

__all__ = [name for name in globals() if name[:1].isupper()]
