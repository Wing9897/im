"""Schema upgrade progress DTO (owned by ``SchemaLifecycle``).

``phase`` and ``message`` are stable machine keys. The web UI localizes them
via ``common.schema.phases.*`` / ``common.schema.messages.*``.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SchemaProgress:
    phase: str = "idle"
    percent: int = 0
    #: Stable message key for ``common.schema.messages.<key>`` (not user-facing prose).
    message: str = ""
