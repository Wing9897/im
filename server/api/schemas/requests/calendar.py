"""Calendar import, dismissal, and user-event request models."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from server.api.schemas.notify_pref import CoercedNotifyPref


class TimelineDismissalBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str
    eventId: str


class TimelineImportanceBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str
    eventId: str


class CalendarImportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str
    sourceId: str = "ics"


class CalendarImportSelectionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    uid: str
    fingerprint: str


class CalendarImportCommitBody(CalendarImportInput):
    selections: list[CalendarImportSelectionBody] = Field(min_length=1, max_length=2_000)


class UserEventCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    startTime: str
    endTime: str | None = None
    body: str = ""
    location: str = ""
    isAllDay: bool = False
    remindBeforeDays: int | None = None
    taskId: str | None = None
    itemId: str | None = None
    worksetId: str | None = None
    #: ``normal`` (default) | ``expires`` | ``purchase_effective``.
    kind: Literal["normal", "expires", "purchase_effective"] = "normal"
    amount: float | None = None
    direction: Literal["expense", "income"] | None = None
    #: Per-event reminder; omitted → ``off``. No force-on.
    notifyPref: CoercedNotifyPref | None = None
    #: Optional card glyph; omitted → NULL.
    emoji: str | None = None


class UserEventPatchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    startTime: str | None = None
    endTime: str | None = Field(default=None)
    body: str | None = None
    location: str | None = None
    isAllDay: bool | None = None
    remindBeforeDays: int | None = None
    taskId: str | None = None
    itemId: str | None = None
    worksetId: str | None = None
    kind: Literal["normal", "expires", "purchase_effective"] | None = None
    amount: float | None = None
    direction: Literal["expense", "income"] | None = None
    notifyPref: CoercedNotifyPref | None = None
    #: Optional card glyph; omitted → NULL.
    emoji: str | None = None


class RecurringSeriesCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    rrule: str
    eventStartTime: str | None = None
    eventEndTime: str | None = None
    eventIsAllDay: bool = False
    eventLocation: str | None = None
    eventDescription: str | None = None
    description: str | None = None
    worksetId: str | None = None
    parentTaskId: str | None = Field(
        default=None,
        description="Optional agent parent for nested recurring children",
    )
    itemId: str | None = Field(
        default=None,
        description="Optional parent trackable item for this recurring calendar",
    )
    #: Per-series reminder; omitted → ``off``. Recurring create
    #: has no ``remindBeforeDays`` — notifyPref is still persisted.
    notifyPref: CoercedNotifyPref | None = None
    #: Optional card glyph; omitted → NULL.
    emoji: str | None = None


class RecurringSeriesPatchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    rrule: str | None = None
    eventStartTime: str | None = None
    eventEndTime: str | None = None
    eventIsAllDay: bool | None = None
    eventLocation: str | None = None
    eventDescription: str | None = None
    description: str | None = None
    isActive: bool | None = None
    worksetId: str | None = None
    itemId: str | None = None
    notifyPref: CoercedNotifyPref | None = None
    #: Optional card glyph; omitted → NULL.
    emoji: str | None = None
