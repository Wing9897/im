"""Single source of truth for ``actions.action_type`` vocabulary.

DDL CHECK in ``server/db/schema_domains/actions.py`` embeds
``ACTION_TYPE_CHECK_SQL``. The executor handler registry
(``server/actions/__init__.py``) and ``server/action_config.py`` sensitive-field
map key off these values (asserted by the drift test).
"""

from __future__ import annotations

from typing import Final, Literal

ACTION_TYPE_TELEGRAM_BOT: Final = "telegram_bot"
ACTION_TYPE_DISCORD_WEBHOOK: Final = "discord_webhook"
ACTION_TYPE_HTTP_WEBHOOK: Final = "http_webhook"
ACTION_TYPE_MQTT: Final = "mqtt"

ActionTypeWire = Literal["telegram_bot", "discord_webhook", "http_webhook", "mqtt"]

ALL_ACTION_TYPES: Final[tuple[ActionTypeWire, ...]] = (
    ACTION_TYPE_TELEGRAM_BOT,
    ACTION_TYPE_DISCORD_WEBHOOK,
    ACTION_TYPE_HTTP_WEBHOOK,
    ACTION_TYPE_MQTT,
)

ALLOWED_ACTION_TYPES: Final[frozenset[str]] = frozenset(ALL_ACTION_TYPES)

ACTION_TYPE_CHECK_SQL = "CHECK (action_type IN ({}))".format(",".join(f"'{value}'" for value in ALL_ACTION_TYPES))
