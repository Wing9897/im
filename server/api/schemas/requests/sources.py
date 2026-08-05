"""Request models for collector source endpoints."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from server.collector.http_poll import DEFAULT_MAX_CONTENT_CHARS, DEFAULT_TIMEOUT_SECONDS
from server.collector.poll_config import DEFAULT_POLL_INTERVAL


class _SourceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DiscordBotBody(_SourceRequest):
    botToken: str
    name: Optional[str] = None


class DiscordBotPatchBody(_SourceRequest):
    botToken: Optional[str] = None
    name: Optional[str] = None


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
    name: Optional[str] = None


class EmailMailboxPatchBody(_SourceRequest):
    imapHost: Optional[str] = None
    imapPort: Optional[int] = None
    useSsl: Optional[bool] = None
    username: Optional[str] = None
    password: Optional[str] = None
    folders: Optional[list[str]] = None
    pollIntervalSeconds: Optional[int] = None
    initialSyncDays: Optional[int] = None
    initialSyncMaxMessages: Optional[int] = None
    senderAllowlist: Optional[list[str]] = None
    markAsRead: Optional[bool] = None
    resetCursors: bool = False
    name: Optional[str] = None


class MqttBrokerBody(_SourceRequest):
    brokerUrl: str
    topics: list[str]
    username: Optional[str] = None
    password: Optional[str] = None
    clientId: Optional[str] = None


class MqttBrokerPatchBody(_SourceRequest):
    brokerUrl: Optional[str] = None
    topics: Optional[list[str]] = None
    username: Optional[str] = None
    password: Optional[str] = None
    clientId: Optional[str] = None
    name: Optional[str] = None


class RssFeedBody(_SourceRequest):
    feedUrl: str
    name: Optional[str] = None
    pollIntervalSeconds: int = DEFAULT_POLL_INTERVAL


class RssFeedPatchBody(_SourceRequest):
    feedUrl: Optional[str] = None
    pollIntervalSeconds: Optional[int] = None
    name: Optional[str] = None


class HttpSourceBody(_SourceRequest):
    url: str
    name: Optional[str] = None
    method: str = "GET"
    authType: str = "none"
    bearerToken: Optional[str] = None
    basicUsername: Optional[str] = None
    basicPassword: Optional[str] = None
    headers: dict[str, str] = Field(default_factory=dict)
    bodyType: str = "none"
    body: Optional[str] = None
    pollIntervalSeconds: int = DEFAULT_POLL_INTERVAL
    maxContentChars: int = DEFAULT_MAX_CONTENT_CHARS
    timeoutSeconds: int = DEFAULT_TIMEOUT_SECONDS


class HttpSourcePatchBody(_SourceRequest):
    url: Optional[str] = None
    name: Optional[str] = None
    method: Optional[str] = None
    authType: Optional[str] = None
    bearerToken: Optional[str] = None
    basicUsername: Optional[str] = None
    basicPassword: Optional[str] = None
    headers: Optional[dict[str, str]] = None
    bodyType: Optional[str] = None
    body: Optional[str] = None
    pollIntervalSeconds: Optional[int] = None
    maxContentChars: Optional[int] = None
    timeoutSeconds: Optional[int] = None


class TelegramCredentials(_SourceRequest):
    apiId: int
    apiHash: str
    phone: str


class TelegramQrCredentials(_SourceRequest):
    apiId: int
    apiHash: str


class TelegramQrWaitBody(_SourceRequest):
    timeoutSeconds: Optional[float] = Field(default=None, ge=5, le=55)


class TelegramCodeBody(_SourceRequest):
    code: str
    pendingLoginStage: Optional[str] = None
    phoneCodeHash: Optional[str] = None


class Telegram2faBody(_SourceRequest):
    password: str
    pendingLoginStage: Optional[str] = None
    phoneCodeHash: Optional[str] = None


class TelegramPatchBody(_SourceRequest):
    """Safe display-name and stored-credential edits."""

    name: Optional[str] = None
    apiId: Optional[int] = None
    apiHash: Optional[str] = None
    phone: Optional[str] = None
