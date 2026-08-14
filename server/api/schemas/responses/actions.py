"""Automation action response models."""

from __future__ import annotations

from pydantic import BaseModel

from server.domain.action_statuses import ActionTriggerStatus
from server.domain.action_types import ActionTypeWire


class ActionResponse(BaseModel):
    id: str
    name: str
    actionType: ActionTypeWire
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
    status: ActionTriggerStatus
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
