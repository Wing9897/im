"""OpenAPI component schemas for the 8 SSE event payloads.

``GET /api/v1/events`` streams named SSE events whose ``data`` field is the
JSON envelope ``{"type": <event>, "payload": {...}}`` (see ``server/sse.py``).
The stream is not a JSON response, so these models are exported to OpenAPI as
components via ``server/api/openapi_ext.py`` — the web client generates its
``web/src/types/events.ts`` aliases from them and the desktop shell mirrors
the analysis payloads in ``desktop/notifications.ts``.

Publish sites still build plain dicts (scheduler / collector / routes);
``server/tests/test_contract_sse.py`` validates representative payloads
against these models so the schema cannot drift silently.

Deliberate wire quirk: ``collector_status_changed`` carries snake_case
adapter fields (``adapter_name`` / ``error_summary`` / ``correlation_id``)
unlike the otherwise camelCase payloads — kept for wire compatibility, do
not camelize (see ``CollectorManager._publish_aggregate_collector_status``).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from server.api.schemas.responses.messages import MessageResponse
from server.domain.analysis_modes import AnalysisMode

#: Mirrors ``server.sse.EVENT_TYPES`` (drift-tested in test_contract_sse.py).
SseEventType = Literal[
    "messages_updated",
    "collector_status_changed",
    "source_status_changed",
    "analysis_started",
    "analysis_completed",
    "analysis_failed",
    "analysis_paused_changed",
    "resource_modified",
]


class SseMessagesUpdatedPayload(BaseModel):
    """``messages_updated`` — newly inserted messages (collector / ingest)."""

    model_config = ConfigDict(extra="forbid")

    messages: list[MessageResponse]


class SseCollectorStatusChangedPayload(BaseModel):
    """``collector_status_changed`` — aggregate collector process status."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["running", "stopped", "error"]
    adapter_name: str | None = Field(
        default=None,
        description="Failing adapter name. Deliberately snake_case (wire contract).",
    )
    error_summary: str | None = Field(
        default=None,
        description="Error summary when an adapter connection fails. Deliberately snake_case.",
    )
    correlation_id: str | None = Field(
        default=None,
        description="Trace id for error-toast correlation. Deliberately snake_case.",
    )


class SseSourceStatusChangedPayload(BaseModel):
    """``source_status_changed`` — per-source adapter connection changes.

    ``connecting`` is a transient reconnect state that is never persisted to
    ``sources.status`` (DB CHECK allows connected/disconnected/error only).
    """

    model_config = ConfigDict(extra="forbid")

    sourceId: str
    status: Literal["connected", "connecting", "disconnected", "error"]
    lastError: str | None = None


class SseAnalysisStartedPayload(BaseModel):
    """``analysis_started`` — a batch (or agent tick) entered the LLM call."""

    model_config = ConfigDict(extra="forbid")

    taskId: str
    taskName: str
    batchId: str
    messageCount: int
    estimatedTokens: int
    llmProvider: str
    llmModel: str
    #: Agent ticks only: resolved web-search route mode.
    webSearchMode: str | None = None
    #: Agent ticks only; message-batch starts omit it.
    analysisMode: AnalysisMode | None = None


class SseOverlapStatistics(BaseModel):
    """Overlap token statistics attached to message-batch completions."""

    model_config = ConfigDict(extra="forbid")

    overlapUsedCount: int
    overlapTrimmedCount: int
    overlapTokens: int
    primaryTokens: int
    totalTokens: int


class SseAnalysisCompletedPayload(BaseModel):
    """``analysis_completed`` — batch / agent tick finished (or was skipped)."""

    model_config = ConfigDict(extra="forbid")

    taskId: str
    batchId: str
    analysisMode: AnalysisMode
    findingsCount: int
    hasFindings: bool
    #: Message-batch pipeline only; agent ticks omit it.
    overlapStatistics: SseOverlapStatistics | None = None
    #: Agent ticks only: web-search route actually used (e.g. ``agent:brave``).
    webSearchMode: str | None = None
    #: Agent ticks only.
    messageCount: int | None = None
    #: Agent ticks only: tick was skipped before calling the LLM.
    skipped: bool | None = None
    skipReason: str | None = None


class SseAnalysisFailedPayload(BaseModel):
    """``analysis_failed`` — batch error (retry-in-place) or agent tick failure."""

    model_config = ConfigDict(extra="forbid")

    taskId: str
    taskName: str
    batchId: str
    error: str
    retrying: bool
    currentRetry: int
    maxRetries: int
    retriesExhausted: bool
    #: Agent ticks only.
    analysisMode: AnalysisMode | None = None
    #: Agent ticks only: task auto-deactivated after consecutive failures.
    taskDeactivated: bool | None = None


class SseAnalysisPausedChangedPayload(BaseModel):
    """``analysis_paused_changed`` — exhausted retries auto-paused global analysis."""

    model_config = ConfigDict(extra="forbid")

    analysisPaused: bool
    reason: Literal["batch_retries_exhausted"]
    taskId: str
    taskName: str
    batchId: str


class SseResourceModifiedPayload(BaseModel):
    """``resource_modified`` — resource CRUD invalidation (see ``publish_resource_modified``)."""

    model_config = ConfigDict(extra="forbid")

    resourceType: str
    resourceId: str
    action: Literal["created", "updated", "deleted"]


SseEventPayload = (
    SseMessagesUpdatedPayload
    | SseCollectorStatusChangedPayload
    | SseSourceStatusChangedPayload
    | SseAnalysisStartedPayload
    | SseAnalysisCompletedPayload
    | SseAnalysisFailedPayload
    | SseAnalysisPausedChangedPayload
    | SseResourceModifiedPayload
)


class SseEventEnvelope(BaseModel):
    """``data`` field of each named SSE frame: ``{"type": <event>, "payload": {...}}``."""

    model_config = ConfigDict(extra="forbid")

    type: SseEventType
    payload: SseEventPayload
