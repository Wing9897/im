"""Pydantic wire alias for ``notifyPref`` (``follow`` / ``off``; ``on`` is 422)."""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BeforeValidator

from server.domain.notify_prefs import NotifyPref, normalize_notify_pref


def coerce_notify_pref_wire(value: Any) -> Any:
    """Accept omitted / blank as-is; reject unknown values including legacy ``on``."""
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return normalize_notify_pref(value)


CoercedNotifyPref = Annotated[NotifyPref, BeforeValidator(coerce_notify_pref_wire)]
