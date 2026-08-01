"""Read-only viewer response models."""

from __future__ import annotations

from pydantic import BaseModel


class ViewerStatsResponse(BaseModel):
    totalTasks: int
    activeTasks: int
    totalBatches: int
    completedBatches: int
    totalResults: int


class ViewerStatusResponse(BaseModel):
    queueDepth: int
    collectorAlive: bool
    analysisPaused: bool
    uptimeSeconds: int


class ViewerTaskResponse(BaseModel):
    id: str
    name: str
    isActive: bool
    lastAnalysisAt: str | None = None
    cronExpression: str | None = None
