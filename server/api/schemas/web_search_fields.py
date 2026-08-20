"""Pydantic field factory for keyed web-search secrets.

Field names come from ``WEB_SEARCH_SECRET_WIRE_FIELDS`` so OpenAPI / request /
response models cannot drift from the Python SoT.
"""

from __future__ import annotations

from typing import Any

from pydantic import Field

from server.domain.web_search_providers import WEB_SEARCH_SECRET_WIRE_FIELDS


def web_search_secret_field_definitions(*, optional: bool) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    for _, wire in WEB_SEARCH_SECRET_WIRE_FIELDS:
        if optional:
            fields[wire] = (str | None, Field(default=None))
        else:
            fields[wire] = (str, Field(default=""))
    return fields
