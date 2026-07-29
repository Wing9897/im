"""Automation action response models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ActionResponse(BaseModel):
    id: str
    name: str
    actionType: Literal["telegram_bot", "discord_webhook", "http_webhook", "mqtt"]
    configuration: str
    triggerConditions: str | None
    isEnabled: bool
    lastTriggeredAt: str | None
    createdAt: str
    updatedAt: str


class ActionTriggerHistoryEntryResponse(BaseModel):
    id: str
    actionId: str
    taskId: str | None
    batchId: str | None
    triggerReason: str
    status: Literal["success", "failure"]
    errorMessage: str | None
    triggeredAt: str


class ActionTriggerHistoryPageResponse(BaseModel):
    items: list[ActionTriggerHistoryEntryResponse]
    totalCount: int
    hasMore: bool


class ActionToggleResponse(BaseModel):
    id: str
    isEnabled: bool


class ActionTestResponse(BaseModel):
    success: bool
    error: str | None = None
