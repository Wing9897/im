"""CamelCase query aliases aligned with Items routes.

OpenAPI / FE use camelCase (``alias=``). HTTP snake_case dual-read was
removed; clients must send camelCase only. Agent ``tool_args`` snake
tolerance remains a separate permanent boundary.
"""

from __future__ import annotations

from typing import Any

from fastapi import Query


def qalias(camel: str, default: Any = ..., **kwargs: Any) -> Any:
    """Primary OpenAPI query name (camelCase)."""
    return Query(default, alias=camel, **kwargs)
