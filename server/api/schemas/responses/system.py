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


class AiEngineHealthStatusResponse(BaseModel):
    """GET ``/system/ai-engine/status`` — LLM provider connectivity probe."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["available", "unavailable"]
    reason: str | None = None
    provider: str | None = None
    #: Stable setup token (``NO_LLM_PROFILE`` / ``ASSISTANT_SLOT_UNBOUND`` /
    #: ``LLM_PROFILE_INCOMPLETE``). Connectivity failures leave this null.
    errorCode: str | None = None


class AiEngineTestResultResponse(BaseModel):
    """POST ``/system/ai-engine/test`` — minimal-token generation probe result."""

    model_config = ConfigDict(extra="forbid")

    success: bool
    provider: str | None = None
    model: str | None = None
    latencyMs: int
    promptTokens: int
    completionTokens: int
    preview: str | None = None
    error: str | None = None
    errorCode: str | None = None


class CollectorAdapterStatusResponse(BaseModel):
    """One adapter row in ``GET /system/collector/status``."""

    model_config = ConfigDict(extra="forbid")

    name: str
    sourceId: str
    connected: bool
    lastError: str | None = None
    lastConnectedAt: str | None = None


class CollectorStatusResponse(BaseModel):
    """GET ``/system/collector/status`` — aggregate status plus adapter details."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["running", "stopped", "error"]
    adapters: list[CollectorAdapterStatusResponse]


class CollectorRestartResponse(BaseModel):
    """POST ``/system/collector/restart`` — message plus pre-restart status."""

    model_config = ConfigDict(extra="forbid")

    message: str
    previousStatus: str


class AnalysisAbortResponse(BaseModel):
    """POST ``/system/analysis/abort`` — batches failed by the emergency abort."""

    model_config = ConfigDict(extra="forbid")

    analysisPaused: bool
    abortedBatchIds: list[str]


class AnalysisPauseResponse(BaseModel):
    """POST ``/system/analysis/pause`` — scheduler pause state after the call."""

    model_config = ConfigDict(extra="forbid")

    analysisPaused: bool


class RotateSecretsScrubbedCounts(BaseModel):
    """Per-category scrub counts, mirroring ``scrub_undecryptable_secrets``."""

    model_config = ConfigDict(extra="forbid")

    system_config: int
    llm_profiles: int
    sources: int
    stale_connected: int
    actions: int


class RotateSecretsResponse(BaseModel):
    """POST ``/system/rotate-secrets`` — recovery result (data-preserving)."""

    model_config = ConfigDict(extra="forbid")

    message: str
    secretsReady: bool
    #: False when the gate cleared but background services could not be
    #: restarted — the caller must prompt for an application restart.
    runtimeStarted: bool
    scrubbed: RotateSecretsScrubbedCounts


class SystemMessageResponse(BaseModel):
    """Message-only ops acknowledgements (reset / restart)."""

    model_config = ConfigDict(extra="forbid")

    message: str


class RetentionDeletedCounts(BaseModel):
    """Per-category delete counts; keys are table names, mirroring ``RetentionCounts``.

    Device-auth and orphan timeline dismissals / importance markers always run,
    independent of the configured ``retention_*_days`` windows.
    """

    messages: int
    analysis: int
    leaderboard: int
    action_trigger_history: int
    app_logs: int
    user_events: int
    timeline_dismissals: int
    timeline_importance: int
    device_access_tokens: int
    device_sessions: int


class RetentionRunResponse(BaseModel):
    message: str
    deleted: RetentionDeletedCounts


class SystemSettingsSnapshot(BaseModel):
    """GET/PUT ``/config/settings`` wire snapshot (camelCase).

    LLM provider slots / assistant_llm_* retired — use ``/api/v1/llm/profiles``. See ``docs/RETIRED-API.md``.
    """

    model_config = ConfigDict(extra="forbid")

    analysisPaused: bool
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
    agentHistoryMaxMessages: str
    agentHistoryMaxChars: str
    assistantDisplayName: str
    assistantAvatar: str
    userDisplayName: str
    userAvatar: str
    userBackground: str
    mcpEnabled: bool
    a2aEnabled: bool
    mcpCapCalendarRead: bool
    mcpCapCalendarWrite: bool
    mcpCapMessagesSearch: bool
    mcpCapIntelligenceSearch: bool
    mcpCapItemsRead: bool
    mcpCapItemsWrite: bool
