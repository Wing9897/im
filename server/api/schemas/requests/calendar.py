"""Calendar import, dismissal, and user-event request models."""

from pydantic import BaseModel, ConfigDict, Field


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
