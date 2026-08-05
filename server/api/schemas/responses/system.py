"""Retention and settings-snapshot response models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str
    version: str
    runtimeReady: bool
    secretsReady: bool
    secretsError: str | None = None
    schemaVersion: int
    schemaSemver: str
    bindHost: str
    lanAccessEnabled: bool


class RetentionDeletedCounts(BaseModel):
    """Per-category delete counts; keys are table names, mirroring ``RetentionCounts``.

    Device-auth and orphan timeline dismissals always run, independent of the
    configured ``retention_*_days`` windows.
    """

    messages: int
    analysis: int
    leaderboard: int
    action_trigger_history: int
    app_logs: int
    user_events: int
    timeline_dismissals: int
    device_access_tokens: int
    device_sessions: int


class RetentionRunResponse(BaseModel):
    message: str
    deleted: RetentionDeletedCounts


class SystemSettingsSnapshot(BaseModel):
    """GET/PUT ``/config/settings`` wire snapshot (camelCase)."""

    model_config = ConfigDict(extra="forbid")

    llmProvider: Literal["ollama", "openai_compatible", "gemini_compatible", "openrouter"]
    analysisPaused: bool
    ollamaBaseUrl: str
    ollamaModel: str
    ollamaThinkingEnabled: bool
    openaiBaseUrl: str
    openaiModel: str
    openaiApiKey: str
    openaiJsonMode: str
    geminiBaseUrl: str
    geminiModel: str
    geminiApiKey: str
    openrouterBaseUrl: str
    openrouterModel: str
    openrouterApiKey: str
    analysisBatchMessageLimit: str
    analysisMaxTotalChars: str
    analysisMaxEstimatedInputTokens: str
    analysisTraceVerbose: bool
    llmGenerationTimeout: str
    maxBatchRetries: str
    maxConcurrentBatches: str
    analysisStrategyMode: str
    analysisTriggerThreshold: str
    retentionMessagesDays: str
    retentionAnalysisDays: str
    retentionLeaderboardDays: str
    retentionAppLogsDays: str
    retentionUserEventsDays: str
    autoPauseOnRetriesExhausted: bool
    weatherLocation: str
    uiLocale: str
    assistantWebSearchEnabled: bool
    webSearchProvider: str
    braveSearchApiKey: str
    assistantLlmProvider: str
    assistantLlmBaseUrl: str
    assistantLlmModel: str
    assistantLlmApiKey: str
    agentHistoryMaxMessages: str
    agentHistoryMaxChars: str
    assistantDisplayName: str
    assistantAvatar: str
    userDisplayName: str
    userAvatar: str
    userBackground: str
