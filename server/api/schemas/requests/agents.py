"""Interactive and A2A agent request models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from server.api.schemas.responses import TaskDraftPayload


class AgentChatMessage(BaseModel):
    """One turn of client-supplied chat history.

    Client ``system`` turns are accepted but dropped before the prompt is built
    (``server.agent.runtime_parse.messages_for_channel``) — the server owns the
    system prompt.
    """

    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant", "system"]
    content: str


class A2aAgentBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input: str = Field(default="", max_length=8000)
    messages: list[AgentChatMessage] = Field(default_factory=list)
    locale: str | None = None


class AgentChatBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[AgentChatMessage] = Field(default_factory=list)
    sessionId: str | None = None
    locale: str | None = None
    worksetId: str | None = None
    surface: Literal["task_editor"] | None = None
    currentTask: TaskDraftPayload | None = None
    #: Optional complete ``llm_profiles.id`` override for this turn.
    #: When omitted: hard-bound global assistant slot (same as liaison).
    #: A2A uses the separate ``liaison`` slot — never this path.
    llmProfileId: str | None = None
