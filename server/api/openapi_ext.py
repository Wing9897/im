"""OpenAPI export extensions for contracts no route body references.

Two families are injected at schema-export time (``app.openapi()``):

* **SSE event payloads** (``server/api/schemas/responses/sse.py``):
  ``GET /api/v1/events`` streams ``text/event-stream``, so its 200 response is
  rewritten to reference ``SseEventEnvelope`` instead of the default empty
  ``application/json`` body.
* **Action embedded-JSON configs** (``server/api/schemas/action_configs.py``):
  the wire carries them inside string fields, so their object shapes exist as
  components only.

Component names equal the Pydantic class names; definitions already produced
by FastAPI (e.g. ``MessageResponse``) are never overwritten, so ``$ref``\\ s
from the injected schemas unify with the route-generated components.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from server.api.schemas.action_configs import (
    ActionTriggerConditions,
    DiscordWebhookConfig,
    HttpWebhookConfig,
    MqttConfig,
    TelegramBotConfig,
)
from server.api.schemas.responses.sse import (
    SseAnalysisCompletedPayload,
    SseAnalysisFailedPayload,
    SseAnalysisPausedChangedPayload,
    SseAnalysisStartedPayload,
    SseCollectorStatusChangedPayload,
    SseEventEnvelope,
    SseMessagesUpdatedPayload,
    SseResourceModifiedPayload,
    SseSourceStatusChangedPayload,
)

_REF_TEMPLATE = "#/components/schemas/{model}"

#: Injected in this order; nested models land via each schema's ``$defs``.
EXTRA_COMPONENT_MODELS: tuple[type[BaseModel], ...] = (
    SseMessagesUpdatedPayload,
    SseCollectorStatusChangedPayload,
    SseSourceStatusChangedPayload,
    SseAnalysisStartedPayload,
    SseAnalysisCompletedPayload,
    SseAnalysisFailedPayload,
    SseAnalysisPausedChangedPayload,
    SseResourceModifiedPayload,
    SseEventEnvelope,
    TelegramBotConfig,
    DiscordWebhookConfig,
    HttpWebhookConfig,
    MqttConfig,
    ActionTriggerConditions,
)

_EVENTS_PATH = "/api/v1/events"

_EVENTS_RESPONSE_DESCRIPTION = (
    "Server-Sent Events stream. Each named event's `data` field is the JSON "
    'envelope `{"type": <event>, "payload": {...}}` (`SseEventEnvelope`); '
    "clients unwrap `payload` per event type. `collector_status_changed` "
    "deliberately uses snake_case adapter fields (`adapter_name`, "
    "`error_summary`, `correlation_id`)."
)


def _strip_null_defaults(node: Any) -> None:
    """Drop ``"default": null`` recursively — matches FastAPI's component output,
    so optional fields stay optional (not required-with-default) in generated TS."""
    if isinstance(node, dict):
        if node.get("default", ...) is None:
            del node["default"]
        for value in node.values():
            _strip_null_defaults(value)
    elif isinstance(node, list):
        for item in node:
            _strip_null_defaults(item)


def _inject_component_schemas(schema: dict[str, Any]) -> None:
    components = schema.setdefault("components", {}).setdefault("schemas", {})
    for model in EXTRA_COMPONENT_MODELS:
        model_schema = model.model_json_schema(ref_template=_REF_TEMPLATE)
        _strip_null_defaults(model_schema)
        # Route-generated definitions win so $refs unify on one component.
        for name, definition in model_schema.pop("$defs", {}).items():
            components.setdefault(name, definition)
        components.setdefault(model.__name__, model_schema)


def _document_events_stream(schema: dict[str, Any]) -> None:
    operation = schema.get("paths", {}).get(_EVENTS_PATH, {}).get("get")
    if operation is None:  # pragma: no cover — events router is always mounted
        return
    operation.setdefault("responses", {})["200"] = {
        "description": _EVENTS_RESPONSE_DESCRIPTION,
        "content": {
            "text/event-stream": {
                "schema": {"$ref": _REF_TEMPLATE.format(model="SseEventEnvelope")},
            },
        },
    }


def install_openapi_extensions(app: FastAPI) -> None:
    """Wrap ``app.openapi`` so exports include the extra component schemas."""
    original_openapi = app.openapi

    def openapi_with_extensions() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = original_openapi()
        _inject_component_schemas(schema)
        _document_events_stream(schema)
        app.openapi_schema = schema
        return schema

    app.openapi = openapi_with_extensions  # type: ignore[method-assign]
