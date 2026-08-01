"""Account and platform-source response models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from server.api.schemas.responses.messages import ChannelResponse
from server.domain.collector_platforms import CollectorPlatform

AccountPlatform = CollectorPlatform
AccountStatus = Literal["connected", "disconnected", "error"]
AccountNextStep = Literal["connected", "code_required", "2fa_required", "qr_required", "error"]
PendingLoginStage = Literal["code_required", "2fa_required", "qr_required"]


class AccountResponse(BaseModel):
    id: str
    platform: AccountPlatform
    name: str
    status: AccountStatus
    lastError: str | None
    lastConnectedAt: str | None
    createdAt: str
    updatedAt: str


class AddAccountResponse(BaseModel):
    account: AccountResponse
    nextStep: AccountNextStep
    pendingLoginStage: PendingLoginStage | None = None
    phoneCodeHash: str | None = None
    qrUrl: str | None = None
    qrExpiresAt: str | None = None


class RefreshAllAccountsResponse(BaseModel):
    totalAccounts: int
    connectedCount: int
    verificationRequiredCount: int
    errorCount: int
    verificationRequiredAccountIds: list[str]
    errorAccountIds: list[str]


class DiscordChannelInfoResponse(BaseModel):
    id: str
    name: str
    platformChannelId: str
    guildName: str


class DiscordBotInfoResponse(BaseModel):
    account: AccountResponse
    channels: list[DiscordChannelInfoResponse]


class AddDiscordBotResponse(DiscordBotInfoResponse):
    status: str
    errorMessage: str | None


class RssFeedInfoResponse(BaseModel):
    account: AccountResponse
    channel: ChannelResponse | None
    feedUrl: str
    pollIntervalSeconds: int
    lastError: str | None
    lastSuccessAt: str | None


class AddRssFeedResponse(BaseModel):
    account: AccountResponse
    channel: ChannelResponse | None
    feedTitle: str
    status: str
    errorMessage: str | None


class HttpSourceInfoResponse(BaseModel):
    account: AccountResponse
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
    account: AccountResponse
    brokerUrl: str
    topics: list[str]
    clientId: str
    lastError: str | None
    lastSuccessAt: str | None


class AddMqttBrokerResponse(BaseModel):
    account: AccountResponse
    status: str
    errorMessage: str | None


class EmailMailboxInfoResponse(BaseModel):
    account: AccountResponse
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
    account: AccountResponse
    status: str
    errorMessage: str | None
    channels: list[ChannelResponse]


class UpdateTelegramAccountResponse(BaseModel):
    account: AccountResponse
    status: AccountStatus
    errorMessage: str | None
    credentialsUpdated: bool


class DiscordSubscribeResponse(BaseModel):
    status: str
