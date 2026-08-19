"""Single source of truth for per-row notify preference (inherit / off).

DDL CHECK in calendar (``user_events`` / ``recurring_schedules``) and tasks
(``analysis_tasks``) embeds ``NOTIFY_PREF_CHECK_SQL`` (asserted equal to
``ALL_NOTIFY_PREFS`` by drift test). Workset default is a separate boolean
column (``worksets.notify_enabled``), not this two-state enum.

Entity checkbox: checked → ``inherit`` (participate; still gated by workset +
global / DND). Unchecked → ``off`` (mute this row even if the workset is on).
There is no force-on. Wire values ``follow`` and ``on`` are rejected (422).
"""

from __future__ import annotations

from typing import Any, Final, Literal

NOTIFY_PREF_INHERIT: Final = "inherit"
NOTIFY_PREF_OFF: Final = "off"

NotifyPref = Literal["inherit", "off"]

ALL_NOTIFY_PREFS: Final[tuple[NotifyPref, ...]] = (
    NOTIFY_PREF_INHERIT,
    NOTIFY_PREF_OFF,
)

ALLOWED_NOTIFY_PREFS: Final[frozenset[str]] = frozenset(ALL_NOTIFY_PREFS)

DEFAULT_NOTIFY_PREF: Final[NotifyPref] = NOTIFY_PREF_INHERIT
# Calendar / item-linked event create-omit (unchecked 通知). Analysis tasks stay inherit.
DEFAULT_CALENDAR_NOTIFY_PREF: Final[NotifyPref] = NOTIFY_PREF_OFF

NOTIFY_PREF_CHECK_SQL = "CHECK (notify_pref IN ({}))".format(
    ",".join(f"'{value}'" for value in ALL_NOTIFY_PREFS)
)

NOTIFY_PREF_ERROR = "notifyPref must be 'inherit' or 'off'"


def normalize_notify_pref(
    value: Any,
    *,
    default: NotifyPref = DEFAULT_NOTIFY_PREF,
) -> NotifyPref:
    """Blank / omitted → ``default``; unknown values (including ``follow`` / ``on``) raise ``ValueError``."""
    if value is None:
        return default
    text = str(value).strip()
    if not text:
        return default
    if text not in ALLOWED_NOTIFY_PREFS:
        raise ValueError(NOTIFY_PREF_ERROR)
    return text  # type: ignore[return-value]
