"""Request models grouped by API domain."""

from server.api.schemas.requests.actions import ActionBody
from server.api.schemas.requests.agents import A2aAgentBody, AgentChatBody
from server.api.schemas.requests.auth import (
    AccessKeyCreateBody,
    ChangePasswordBody,
    LoginBody,
    RefreshBody,
    RegisterBody,
    ResetPasswordBody,
    RotateSecretsBody,
)
from server.api.schemas.requests.calendar import (
    CalendarImportCommitBody,
    CalendarImportInput,
    CalendarImportSelectionBody,
    TimelineDismissalBody,
    UserEventCreateBody,
    UserEventPatchBody,
)
from server.api.schemas.requests.items import (
    CategoryCreateBody,
    CategoryUpdateBody,
    ItemCreateBody,
    ItemUpdateBody,
)
from server.api.schemas.requests.logs import LogCreate
from server.api.schemas.requests.messages import IngestBatchBody, IngestMessageBody
from server.api.schemas.requests.sources import (
    DiscordBotBody,
    DiscordBotPatchBody,
    DiscordSubscribeBody,
    EmailMailboxBody,
    EmailMailboxPatchBody,
    HttpSourceBody,
    HttpSourcePatchBody,
    MqttBrokerBody,
    MqttBrokerPatchBody,
    RssFeedBody,
    RssFeedPatchBody,
    Telegram2faBody,
    TelegramCodeBody,
    TelegramCredentials,
    TelegramPatchBody,
    TelegramQrCredentials,
    TelegramQrWaitBody,
)
from server.api.schemas.requests.system import AiEngineTestBody, AnalysisPauseBody
from server.api.schemas.requests.tasks import CreateRecurringTaskBody, TaskConfigBody, TaskScheduleBody
from server.api.schemas.requests.worksets import WorksetCreateBody, WorksetUpdateBody

__all__ = [
    "A2aAgentBody",
    "AccessKeyCreateBody",
    "ActionBody",
    "AgentChatBody",
    "AiEngineTestBody",
    "AnalysisPauseBody",
    "CalendarImportCommitBody",
    "CalendarImportInput",
    "CalendarImportSelectionBody",
    "CategoryCreateBody",
    "CategoryUpdateBody",
    "ChangePasswordBody",
    "CreateRecurringTaskBody",
    "DiscordBotBody",
    "DiscordBotPatchBody",
    "DiscordSubscribeBody",
    "EmailMailboxBody",
    "EmailMailboxPatchBody",
    "HttpSourceBody",
    "HttpSourcePatchBody",
    "IngestBatchBody",
    "IngestMessageBody",
    "ItemCreateBody",
    "ItemUpdateBody",
    "LogCreate",
    "LoginBody",
    "MqttBrokerBody",
    "MqttBrokerPatchBody",
    "RssFeedBody",
    "RssFeedPatchBody",
    "RefreshBody",
    "RegisterBody",
    "ResetPasswordBody",
    "RotateSecretsBody",
    "TaskConfigBody",
    "TaskScheduleBody",
    "Telegram2faBody",
    "TelegramCodeBody",
    "TelegramCredentials",
    "TelegramPatchBody",
    "TelegramQrCredentials",
    "TelegramQrWaitBody",
    "TimelineDismissalBody",
    "UserEventCreateBody",
    "UserEventPatchBody",
    "WorksetCreateBody",
    "WorksetUpdateBody",
]
