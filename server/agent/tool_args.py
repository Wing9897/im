"""Coercion helpers for LLM-supplied tool arguments.

Tool arguments arrive as whatever JSON the model produced, so every handler has
to survive strings where numbers belong, empty strings for omitted values, and
snake_case/camelCase spellings of the same key. These helpers are the single
implementation of that coercion for all `tools_*` modules.
"""

from __future__ import annotations

from typing import Any

_TRUE_TOKENS = frozenset({"1", "true", "yes", "y", "on"})
_FALSE_TOKENS = frozenset({"0", "false", "no", "n", "off"})


def as_int(value: Any, default: int) -> int:
    """Parse an int, falling back to ``default`` for omitted or unparsable input."""
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def as_optional_int(value: Any, default: int) -> int | None:
    """Like :func:`as_int`, but ``None`` when the caller omitted the argument.

    Callers use ``None`` to mean「let the query layer pick its own default」,
    which is different from a caller explicitly asking for ``default``.
    """
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def as_bool(value: Any, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in _TRUE_TOKENS:
        return True
    if text in _FALSE_TOKENS:
        return False
    return default


def as_optional_bool(value: Any) -> bool | None:
    """Tri-state flag: ``None`` when omitted or unrecognized."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in _TRUE_TOKENS:
        return True
    if text in _FALSE_TOKENS:
        return False
    return None


def as_optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def arg(args: dict[str, Any], *names: str) -> Any:
    """First present key among ``names`` (camelCase / snake_case aliases)."""
    for name in names:
        if name in args:
            return args[name]
    return None
