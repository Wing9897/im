"""Request models for collector source endpoints."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from server.collector.http_poll import DEFAULT_MAX_CONTENT_CHARS, DEFAULT_TIMEOUT_SECONDS
from server.collector.poll_config import DEFAULT_POLL_INTERVAL


class _SourceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DiscordBotBody(_SourceRequest):
    botToken: str
    name: str | None = None


class DiscordBotPatchBody(_SourceRequest):
    botToken: str | None = None
    name: str | None = None


class DiscordSubscribeBody(_SourceRequest):
    channelIds: list[str]


class EmailMailboxBody(_SourceRequest):
    imapHost: str
    imapPort: int = 993
    useSsl: bool = True
    username: str
    password: str
    folders: list[str] = Field(default_factory=lambda: ["INBOX"])
    pollIntervalSeconds: int = 300
    initialSyncDays: int = 7
    initialSyncMaxMessages: int = 100
    senderAllowlist: list[str] = Field(default_factory=list)
    markAsRead: bool = False
    name: str | None = None


class EmailMailboxPatchBody(_SourceRequest):
    imapHost: str | None = None
    imapPort: int | None = None
    useSsl: bool | None = None
    username: str | None = None
    password: str | None = None
    folders: list[str] | None = None
    pollIntervalSeconds: int | None = None
    initialSyncDays: int | None = None
    initialSyncMaxMessages: int | None = None
    senderAllowlist: list[str] | None = None
    markAsRead: bool | None = None
    resetCursors: bool = False
    name: str | None = None


class MqttBrokerBody(_SourceRequest):
    brokerUrl: str
    topics: list[str]
    username: str | None = None
    password: str | None = None
    clientId: str | None = None


class MqttBrokerPatchBody(_SourceRequest):
    brokerUrl: str | None = None
    topics: list[str] | None = None
    username: str | None = None
    password: str | None = None
    clientId: str | None = None
    name: str | None = None


class RssFeedBody(_SourceRequest):
    feedUrl: str
    name: str | None = None
    pollIntervalSeconds: int = DEFAULT_POLL_INTERVAL


class RssFeedPatchBody(_SourceRequest):
    feedUrl: str | None = None
    pollIntervalSeconds: int | None = None
    name: str | None = None


class HttpSourceBody(_SourceRequest):
    url: str
    name: str | None = None
    method: str = "GET"
    authType: str = "none"
    bearerToken: str | None = None
    basicUsername: str | None = None
    basicPassword: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    bodyType: str = "none"
    body: str | None = None
    pollIntervalSeconds: int = DEFAULT_POLL_INTERVAL
    maxContentChars: int = DEFAULT_MAX_CONTENT_CHARS
    timeoutSeconds: int = DEFAULT_TIMEOUT_SECONDS


class HttpSourcePatchBody(_SourceRequest):
    url: str | None = None
    name: str | None = None
    method: str | None = None
    authType: str | None = None
    bearerToken: str | None = None
    basicUsername: str | None = None
    basicPassword: str | None = None
    headers: dict[str, str] | None = None
    bodyType: str | None = None
    body: str | None = None
    pollIntervalSeconds: int | None = None
    maxContentChars: int | None = None
    timeoutSeconds: int | None = None


class TelegramCredentials(_SourceRequest):
    apiId: int
    apiHash: str
    phone: str


class TelegramQrCredentials(_SourceRequest):
    apiId: int
    apiHash: str


class TelegramQrWaitBody(_SourceRequest):
    timeoutSeconds: float | None = Field(default=None, ge=5, le=55)


class TelegramCodeBody(_SourceRequest):
    code: str
    pendingLoginStage: str | None = None
    phoneCodeHash: str | None = None


class Telegram2faBody(_SourceRequest):
    password: str
    pendingLoginStage: str | None = None
    phoneCodeHash: str | None = None


class TelegramPatchBody(_SourceRequest):
    """Safe display-name and stored-credential edits."""

    name: str | None = None
    apiId: int | None = None
    apiHash: str | None = None
    phone: str | None = None
