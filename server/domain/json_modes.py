"""Single source of truth for ``llm_profiles.json_mode`` wire vocabulary.

DDL CHECK in ``server/db/schema_domains/llm.py`` embeds ``JSON_MODE_CHECK_SQL``.
``server.util.is_openai_json_mode_enabled`` collapses the value to a boolean on
the completion path (any non-``disabled`` value enables JSON output).
"""

from __future__ import annotations

from typing import Final, Literal

JSON_MODE_DISABLED: Final = "disabled"
JSON_MODE_JSON_SCHEMA: Final = "json_schema"
JSON_MODE_JSON_OBJECT: Final = "json_object"

JsonModeWire = Literal["disabled", "json_schema", "json_object"]

ALL_JSON_MODES: Final[tuple[JsonModeWire, ...]] = (
    JSON_MODE_DISABLED,
    JSON_MODE_JSON_SCHEMA,
    JSON_MODE_JSON_OBJECT,
)

ALLOWED_JSON_MODES: Final[frozenset[str]] = frozenset(ALL_JSON_MODES)

JSON_MODE_CHECK_SQL = "CHECK (json_mode IN ({}))".format(",".join(f"'{value}'" for value in ALL_JSON_MODES))
