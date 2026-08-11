"""Runtime-control request models."""

from pydantic import BaseModel, ConfigDict


class AiEngineTestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    llmProvider: str | None = None
    llmBaseUrl: str | None = None
    llmModel: str | None = None
    llmApiKey: str | None = None
    ollamaThinkingEnabled: bool | None = None
    llmProfileId: str | None = None


class AnalysisPauseBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    paused: bool
