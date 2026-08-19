"""OpenAPI component schemas for action ``configuration`` / ``triggerConditions``.

On the wire both fields are JSON **strings** (``ActionBody`` / ``ActionResponse``):
configuration is encrypted at rest and credential-masked on read
(``server/action_config.py``), so no route body references these object shapes
directly. They are exported to OpenAPI as components via
``server/api/openapi_ext.py`` — the web client generates its
``web/src/types/actions.ts`` config aliases from them; parsing/normalization
stays in ``web/src/pages/notify/actionConfigParsers.ts``.

Deliberate wire quirk: field names are snake_case (``bot_token`` …) because
they mirror the stored configuration JSON, not the camelCase API surface.

Keyed by ``server/domain/action_types.py`` vocabulary; the sensitive-field
map is drift-tested against these models in ``test_action_types_drift.py``.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TelegramBotConfig(BaseModel):
    """``telegram_bot`` configuration JSON (``bot_token`` masked on read)."""

    model_config = ConfigDict(extra="forbid")

    bot_token: str
    chat_id: str


class DiscordWebhookConfig(BaseModel):
    """``discord_webhook`` configuration JSON (``webhook_url`` masked on read)."""

    model_config = ConfigDict(extra="forbid")

    webhook_url: str


class HttpWebhookConfig(BaseModel):
    """``http_webhook`` configuration JSON (``url`` and header values masked on read)."""

    model_config = ConfigDict(extra="forbid")

    url: str
    method: Literal["POST", "PUT"]
    headers: dict[str, str]
    include_raw_data: bool


class MqttConfig(BaseModel):
    """``mqtt`` configuration JSON (``password`` masked on read)."""

    model_config = ConfigDict(extra="forbid")

    broker_url: str
    topic: str
    username: str
    password: str
    qos: Literal[0, 1, 2]


class ActionTriggerConditions(BaseModel):
    """``triggerConditions`` JSON — optional trigger filters for an action."""

    model_config = ConfigDict(extra="forbid")

    score_threshold: float | None = Field(
        default=None,
        description="Minimum leaderboard score required to trigger.",
    )
    task_id: str | None = Field(
        default=None,
        description="Restrict triggering to one analysis task.",
    )


#: action_type → configuration schema (SoT keys: server/domain/action_types.py).
ACTION_CONFIG_SCHEMAS: dict[str, type[BaseModel]] = {
    "telegram_bot": TelegramBotConfig,
    "discord_webhook": DiscordWebhookConfig,
    "http_webhook": HttpWebhookConfig,
    "mqtt": MqttConfig,
}
