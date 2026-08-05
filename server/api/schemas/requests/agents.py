"""Interactive and A2A agent request models."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from server.api.schemas.responses import TaskDraftPayload


class A2aAgentBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input: str = Field(default="", max_length=8000)
    messages: list[dict[str, Any]] = Field(default_factory=list)
    locale: str | None = None


class AgentChatBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[dict[str, Any]] = Field(default_factory=list)
    sessionId: str | None = None
    locale: str | None = None
    worksetId: str | None = None
    surface: Literal["task_editor"] | None = None
    currentTask: TaskDraftPayload | None = None
