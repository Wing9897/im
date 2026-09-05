"""Request models for external message ingestion."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

MAX_INGEST_CONTENT_LENGTH = 100_000
MAX_INGEST_BATCH_SIZE = 500


class IngestMessageBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=128)
    sourceId: str | None = Field(default=None, max_length=128)
    channelId: str | None = Field(default=None, max_length=2_048)
    platformId: str | None = Field(default=None, max_length=2_048)
    platform: str = Field(min_length=1, max_length=64)
    platformMessageId: str | None = Field(default=None, max_length=2_048)
    senderId: str | None = Field(default=None, max_length=512)
    senderName: str | None = Field(default=None, max_length=512)
    content: str = Field(default="", max_length=MAX_INGEST_CONTENT_LENGTH)
    timestamp: str | None = Field(default=None, max_length=64)
    metadata: dict[str, Any] | None = None


class IngestBatchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[IngestMessageBody] = Field(min_length=1, max_length=MAX_INGEST_BATCH_SIZE)
