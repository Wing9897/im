"""Source and platform-source response models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from server.api.schemas.responses.messages import ChannelResponse
from server.domain.collector_platforms import CollectorPlatform

SourcePlatform = CollectorPlatform
SourceStatus = Literal["connected", "disconnected", "error"]
SourceNextStep = Literal["connected", "code_required", "2fa_required", "qr_required", "error"]
PendingLoginStage = Literal["code_required", "2fa_required", "qr_required"]


class SourceResponse(BaseModel):
    id: str
    platform: SourcePlatform
    name: str
    status: SourceStatus
    lastError: str | None
    lastConnectedAt: str | None
    createdAt: str
    updatedAt: str


class AddSourceResponse(BaseModel):
    source: SourceResponse
    nextStep: SourceNextStep
    pendingLoginStage: PendingLoginStage | None = None
    phoneCodeHash: str | None = None
    qrUrl: str | None = None
    qrExpiresAt: str | None = None


class RefreshAllSourcesResponse(BaseModel):
    totalSources: int
    connectedCount: int
    verificationRequiredCount: int
    errorCount: int
    verificationRequiredSourceIds: list[str]
    errorSourceIds: list[str]


class DiscordChannelInfoResponse(BaseModel):
    id: str
    name: str
    platformChannelId: str
    guildName: str


class DiscordBotInfoResponse(BaseModel):
    source: SourceResponse
    channels: list[DiscordChannelInfoResponse]


class AddDiscordBotResponse(DiscordBotInfoResponse):
    status: str
    errorMessage: str | None


class RssFeedInfoResponse(BaseModel):
    source: SourceResponse
    channel: ChannelResponse | None
    feedUrl: str
    pollIntervalSeconds: int
    lastError: str | None
    lastSuccessAt: str | None


class AddRssFeedResponse(BaseModel):
    source: SourceResponse
    channel: ChannelResponse | None
    feedTitle: str
    status: str
    errorMessage: str | None


class HttpSourceInfoResponse(BaseModel):
    source: SourceResponse
    channel: ChannelResponse | None
    url: str
    method: str
    authType: str
    bearerToken: str | None
    basicUsername: str | None
    basicPassword: str | None
    headers: dict[str, str]
    bodyType: str
    body: str | None
    pollIntervalSeconds: int
    maxContentChars: int
    timeoutSeconds: int
    lastError: str | None
    lastSuccessAt: str | None


class AddHttpSourceResponse(HttpSourceInfoResponse):
    status: str
    errorMessage: str | None


class MqttBrokerInfoResponse(BaseModel):
    source: SourceResponse
    brokerUrl: str
    topics: list[str]
    clientId: str
    lastError: str | None
    lastSuccessAt: str | None


class AddMqttBrokerResponse(BaseModel):
    source: SourceResponse
    status: str
    errorMessage: str | None


class EmailMailboxInfoResponse(BaseModel):
    source: SourceResponse
    imapHost: str
    imapPort: int
    useSsl: bool
    username: str
    folders: list[str]
    pollIntervalSeconds: int
    initialSyncDays: int
    initialSyncMaxMessages: int
    senderAllowlist: list[str]
    markAsRead: bool
    folderCursors: dict[str, int]
    channels: list[ChannelResponse]
    lastError: str | None
    lastSuccessAt: str | None


class AddEmailMailboxResponse(BaseModel):
    source: SourceResponse
    status: str
    errorMessage: str | None
    channels: list[ChannelResponse]


class UpdateTelegramSourceResponse(BaseModel):
    source: SourceResponse
    status: SourceStatus
    errorMessage: str | None
    credentialsUpdated: bool


class DiscordSubscribeResponse(BaseModel):
    status: str
