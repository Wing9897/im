"""Runtime-control request models."""

from pydantic import BaseModel, ConfigDict

from server.domain.llm_providers import LlmProviderWire


class AiEngineTestBody(BaseModel):
    """Unsaved profile-shaped draft for ``POST /system/ai-engine/test``.

    Same wire fields as ``LlmProfileUpsertBody`` connection card
    (``provider``／``baseUrl``／``model``／``apiKey``／``thinkingEnabled``),
    plus optional ``llmProfileId`` for masked-secret fallback.
    """

    model_config = ConfigDict(extra="forbid")

    provider: LlmProviderWire | None = None
    baseUrl: str | None = None
    model: str | None = None
    apiKey: str | None = None
    thinkingEnabled: bool | None = None
    llmProfileId: str | None = None


class AnalysisPauseBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    paused: bool


class SystemSettingsUpdateBody(BaseModel):
    """Partial ``PUT /config/settings`` body.

    All-optional mirror of ``SystemSettingsSnapshot`` (drift asserted in
    ``server/api/routes/config.py``); unknown keys → 422 via ``extra="forbid"``.
    """

    model_config = ConfigDict(extra="forbid")

    analysisPaused: bool | None = None
    analysisBatchMessageLimit: str | None = None
    analysisMaxTotalChars: str | None = None
    analysisMaxEstimatedInputTokens: str | None = None
    analysisTraceVerbose: bool | None = None
    llmGenerationTimeout: str | None = None
    maxBatchRetries: str | None = None
    maxConcurrentBatches: str | None = None
    analysisStrategyMode: str | None = None
    analysisTriggerThreshold: str | None = None
    retentionMessagesDays: str | None = None
    retentionAnalysisDays: str | None = None
    retentionLeaderboardDays: str | None = None
    retentionAppLogsDays: str | None = None
    retentionUserEventsDays: str | None = None
    autoPauseOnRetriesExhausted: bool | None = None
    weatherLocation: str | None = None
    uiLocale: str | None = None
    agentHistoryMaxMessages: str | None = None
    agentHistoryMaxChars: str | None = None
    assistantDisplayName: str | None = None
    assistantAvatar: str | None = None
    userDisplayName: str | None = None
    userAvatar: str | None = None
    userBackground: str | None = None
    mcpEnabled: bool | None = None
    mcpCapCalendarRead: bool | None = None
    mcpCapCalendarWrite: bool | None = None
    mcpCapMessagesSearch: bool | None = None
    mcpCapIntelligenceSearch: bool | None = None
    mcpCapItemsRead: bool | None = None
    mcpCapItemsWrite: bool | None = None
