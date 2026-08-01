"""Collected message and channel response models."""

from __future__ import annotations

from pydantic import BaseModel


class MessageMediaResponse(BaseModel):
    kind: str
    mime: str | None = None


class MessageResponse(BaseModel):
    id: str
    accountId: str | None
    platform: str
    platformId: str
    channelName: str | None
    platformMessageId: str | None
    senderId: str | None
    senderName: str | None
    content: str
    timestamp: str
    rawData: str | None
    media: MessageMediaResponse | None
    createdAt: str


class MessageCursorResponse(BaseModel):
    timestamp: str
    id: str


class MessagesPageResponse(BaseModel):
    messages: list[MessageResponse]
    nextCursor: MessageCursorResponse | None
    hasMore: bool
    totalCount: int | None


class MessagesIngestBatchResponse(BaseModel):
    count: int


class ChannelResponse(BaseModel):
    id: str
    platform: str
    platformId: str
    channelName: str
    createdAt: str


class ChannelWithAccountResponse(BaseModel):
    id: str
    platform: str
    platformId: str
    channelName: str
    createdAt: str
    accountIds: list[str]
    accountId: str | None
    accountName: str | None
