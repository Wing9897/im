"""Schema-gate, retention, and settings-snapshot response models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class SchemaUpgradeProgress(BaseModel):
    """Progress uses stable ``phase`` / ``message`` keys; UI localizes them."""

    phase: str
    percent: int
    message: str  # message key, not localized prose


class SchemaUpgradeStatusResponse(BaseModel):
    state: str
    runtimeReady: bool
    schemaVersion: int
    requiredSchemaVersion: int
    schemaSemver: str
    backupPath: str | None
    error: str | None
    restoredFromBackup: bool
    progress: SchemaUpgradeProgress


class RetentionDeletedCounts(BaseModel):
    """Per-category delete counts; keys are table names, mirroring ``RetentionCounts``.

    Device-auth, orphan timeline dismissals, assistant-store and A2A-audit TTL
    categories always run, independent of the configured ``retention_*_days``
    windows.
    """

    messages: int
    analysis: int
    leaderboard: int
    action_trigger_history: int
    app_logs: int
    user_events: int
    timeline_dismissals: int
    assistant_device_stores: int
    device_access_tokens: int
    device_sessions: int
    a2a_audit_log: int


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
    intelligenceRulesVersion: str
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
