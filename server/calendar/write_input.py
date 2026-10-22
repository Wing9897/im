"""HTTP-agnostic calendar write payloads.

Field names match the wire bodies. This is a plain data carrier, not an
OpenAPI / Pydantic model: routes and calendar tools copy values here, then
call ``user_events_write`` / ``recurring_series_create`` / ``recurring_series_patch``. ``fields_set`` is
the keys the caller supplied. Create bodies also include the defaults the
historical routes always forwarded. Omitted ``worksetId`` stays omitted so
the service can keep its inherit-versus-explicit sentinel.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field, fields, replace
from typing import Any, Literal

from server.agent.tool_args import arg, as_bool
from server.domain.user_event_origins import (
    ORIGIN_ASSISTANT,
    ORIGIN_MANUAL,
    TOOL_WRITE_USER_EVENT_ORIGINS,
)
from server.worksets_const import SYSTEM_WORKSET_ID

WriteAction = Literal["create", "update"]

_USER_EVENT_SERVICE_KEYS: dict[str, str] = {
    "title": "title",
    "startTime": "start_time",
    "endTime": "end_time",
    "body": "body",
    "location": "location",
    "isAllDay": "is_all_day",
    "remindBeforeDays": "remind_before_days",
    "taskId": "task_id",
    "itemId": "item_id",
    "worksetId": "workset_id",
    "kind": "kind",
    "amount": "amount",
    "direction": "direction",
    "notifyPref": "notify_pref",
    "emoji": "emoji",
    "origin": "origin",
}

# Keys POST /user-events always forwarded. notifyPref / emoji / worksetId stay
# out: omitting them is different from passing the function default.
_USER_EVENT_CREATE_FIELDS = frozenset(
    {
        "title",
        "startTime",
        "endTime",
        "body",
        "location",
        "origin",
        "isAllDay",
        "remindBeforeDays",
        "taskId",
        "itemId",
        "kind",
        "amount",
        "direction",
    }
)

_RECURRING_SERVICE_KEYS: dict[str, str] = {
    "name": "name",
    "rrule": "rrule",
    "eventStartTime": "event_start_time",
    "eventEndTime": "event_end_time",
    "eventIsAllDay": "event_is_all_day",
    "eventLocation": "event_location",
    "eventDescription": "event_description",
    "description": "description",
    "isActive": "is_active",
    "worksetId": "workset_id",
    "parentTaskId": "parent_task_id",
    "itemId": "item_id",
    "notifyPref": "notify_pref",
    "emoji": "emoji",
    "seriesId": "series_id",
    "requireParentTaskId": "require_parent_task_id",
}

# Keys POST /calendar/recurring always forwarded. worksetId stays out so an
# omitted id remains the service Ellipsis (inherit parent / system workset).
_RECURRING_CREATE_FIELDS = frozenset(
    {
        "name",
        "rrule",
        "eventStartTime",
        "eventEndTime",
        "eventIsAllDay",
        "eventLocation",
        "eventDescription",
        "description",
        "parentTaskId",
        "itemId",
        "notifyPref",
        "emoji",
    }
)

_RECURRING_IDENTITY_FIELDS = frozenset({"seriesId", "requireParentTaskId"})


def _field_names(cls: type) -> set[str]:
    return {item.name for item in fields(cls) if item.name != "fields_set"}


def _values_from_dump(cls: type, dumped: Mapping[str, Any]) -> dict[str, Any]:
    names = _field_names(cls)
    return {name: dumped[name] for name in names if name in dumped}


def _is_create_body(body: Any, required_field: str) -> bool:
    """Create models require ``required_field``; patch models default it."""
    return bool(type(body).model_fields[required_field].is_required())


def _service_kwargs(payload: Any, wire_to_service: Mapping[str, str]) -> dict[str, Any]:
    supplied = payload.fields_set
    return {service: getattr(payload, wire) for wire, service in wire_to_service.items() if wire in supplied}


def _tool_task_id(args: Mapping[str, Any]) -> Any:
    if "taskId" in args or "task_id" in args:
        return arg(args, "taskId", "task_id")
    return args.get("_default_task_id")


def _tool_workset_id(args: Mapping[str, Any]) -> Any:
    if "worksetId" in args or "workset_id" in args:
        return arg(args, "worksetId", "workset_id")
    if "_default_workset_id" in args:
        return args.get("_default_workset_id")
    return None


def _has_key(args: Mapping[str, Any], *names: str) -> bool:
    return any(name in args for name in names)


def _explicit_workset(value: Any) -> str:
    """Empty wire worksetId on recurring HTTP writes is the system workset."""
    return value if value else SYSTEM_WORKSET_ID


@dataclass
class UserEventWriteInput:
    """Values a user-event create/update may persist, plus which keys were set."""

    title: str | None = None
    startTime: str | None = None
    endTime: str | None = None
    body: str | None = None
    location: str | None = None
    isAllDay: bool | None = None
    remindBeforeDays: int | None = None
    taskId: str | None = None
    itemId: str | None = None
    worksetId: str | None = None
    kind: str | None = None
    amount: float | None = None
    direction: str | None = None
    notifyPref: str | None = None
    emoji: str | None = None
    origin: str | None = None
    fields_set: frozenset[str] = field(default_factory=frozenset)

    @property
    def model_fields_set(self) -> set[str]:
        """Same role as Pydantic ``model_fields_set``: keys the caller supplied."""
        return set(self.fields_set)

    @classmethod
    def from_pydantic_body(cls, body: Any) -> UserEventWriteInput:
        """Copy a parsed user-event wire body into the service write input."""
        dumped = body.model_dump()
        values = _values_from_dump(cls, dumped)
        supplied = set(body.model_fields_set)
        if _is_create_body(body, "title"):
            values["origin"] = ORIGIN_MANUAL
            values["isAllDay"] = bool(body.isAllDay)
            supplied |= _USER_EVENT_CREATE_FIELDS
        return cls(fields_set=frozenset(supplied & _field_names(cls)), **values)

    @classmethod
    def from_tool_args(cls, args: Mapping[str, Any], *, action: WriteAction) -> UserEventWriteInput:
        """Copy calendar tool arguments, including camelCase / snake_case aliases."""
        if action == "create":
            return cls._from_tool_create(args)
        if action == "update":
            return cls._from_tool_update(args)
        raise ValueError(f"unknown write action: {action}")

    @classmethod
    def _from_tool_create(cls, args: Mapping[str, Any]) -> UserEventWriteInput:
        title = args.get("title")
        start = arg(args, "startTime", "start", "start_time")
        end = arg(args, "endTime", "end", "end_time")
        origin = str(args.get("_origin") or ORIGIN_ASSISTANT).strip() or ORIGIN_ASSISTANT
        if origin not in TOOL_WRITE_USER_EVENT_ORIGINS:
            origin = ORIGIN_ASSISTANT
        values: dict[str, Any] = {
            "title": str(title) if title else None,
            "startTime": str(start) if start else None,
            "endTime": str(end) if end else None,
            "body": str(arg(args, "body", "description") or ""),
            "location": str(args.get("location") or ""),
            "origin": origin,
            "taskId": _tool_task_id(args),
            "kind": "normal",
        }
        supplied = set(values)
        workset_id = _tool_workset_id(args)
        if workset_id is not None:
            values["worksetId"] = workset_id
            supplied.add("worksetId")
        return cls(fields_set=frozenset(supplied), **values)

    @classmethod
    def _from_tool_update(cls, args: Mapping[str, Any]) -> UserEventWriteInput:
        values: dict[str, Any] = {}
        supplied: set[str] = set()
        if "title" in args and args["title"] is not None:
            values["title"] = str(args["title"])
            supplied.add("title")
        if _has_key(args, "startTime", "start", "start_time"):
            values["startTime"] = str(arg(args, "startTime", "start", "start_time"))
            supplied.add("startTime")
        if _has_key(args, "endTime", "end", "end_time"):
            end_val = arg(args, "endTime", "end", "end_time")
            values["endTime"] = None if end_val in (None, "") else str(end_val)
            supplied.add("endTime")
        if _has_key(args, "body", "description"):
            values["body"] = str(arg(args, "body", "description") or "")
            supplied.add("body")
        if "location" in args:
            values["location"] = str(args.get("location") or "")
            supplied.add("location")
        if _has_key(args, "taskId", "task_id"):
            values["taskId"] = arg(args, "taskId", "task_id")
            supplied.add("taskId")
        if _has_key(args, "worksetId", "workset_id"):
            values["worksetId"] = arg(args, "worksetId", "workset_id")
            supplied.add("worksetId")
        return cls(fields_set=frozenset(supplied), **values)

    def service_kwargs(self) -> dict[str, Any]:
        """Snake_case kwargs for ``create_user_event`` / ``update_user_event``."""
        return _service_kwargs(self, _USER_EVENT_SERVICE_KEYS)


@dataclass
class RecurringSeriesWriteInput:
    """Values a recurring-series create/update may persist, plus which keys were set."""

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
    parentTaskId: str | None = None
    itemId: str | None = None
    notifyPref: str | None = None
    emoji: str | None = None
    seriesId: str | None = None
    requireParentTaskId: str | None = None
    fields_set: frozenset[str] = field(default_factory=frozenset)

    @property
    def model_fields_set(self) -> set[str]:
        """Same role as Pydantic ``model_fields_set``: keys the caller supplied."""
        return set(self.fields_set)

    @classmethod
    def from_pydantic_body(cls, body: Any) -> RecurringSeriesWriteInput:
        """Copy a parsed recurring-series wire body into the service write input."""
        dumped = body.model_dump()
        values = _values_from_dump(cls, dumped)
        supplied = set(body.model_fields_set)
        if "worksetId" in supplied:
            values["worksetId"] = _explicit_workset(values.get("worksetId"))
        if _is_create_body(body, "name"):
            values["eventIsAllDay"] = bool(body.eventIsAllDay)
            supplied |= _RECURRING_CREATE_FIELDS
        return cls(fields_set=frozenset(supplied & _field_names(cls)), **values)

    @classmethod
    def from_tool_args(cls, args: Mapping[str, Any], *, action: WriteAction) -> RecurringSeriesWriteInput:
        """Copy calendar tool arguments, including camelCase / snake_case aliases."""
        if action == "create":
            return cls._from_tool_create(args)
        if action == "update":
            return cls._from_tool_update(args)
        raise ValueError(f"unknown write action: {action}")

    @classmethod
    def _from_tool_create(cls, args: Mapping[str, Any]) -> RecurringSeriesWriteInput:
        name = arg(args, "name", "title")
        parent_raw = args.get("_parent_task_id")
        parent_task_id = str(parent_raw).strip() if parent_raw not in (None, "") else None
        values: dict[str, Any] = {
            "name": str(name or ""),
            "rrule": str(arg(args, "rrule", "RRule") or ""),
            "eventStartTime": arg(args, "eventStartTime", "startTime", "start"),
            "eventEndTime": arg(args, "eventEndTime", "endTime", "end"),
            "eventIsAllDay": as_bool(arg(args, "eventIsAllDay", "isAllDay"), False),
            "eventLocation": arg(args, "eventLocation", "location"),
            "eventDescription": arg(args, "eventDescription", "body", "description"),
            "parentTaskId": parent_task_id,
        }
        supplied = set(values)
        workset_id = _tool_workset_id(args)
        if workset_id is not None:
            values["worksetId"] = workset_id
            supplied.add("worksetId")
        return cls(fields_set=frozenset(supplied), **values)

    @classmethod
    def _from_tool_update(cls, args: Mapping[str, Any]) -> RecurringSeriesWriteInput:
        series_raw = arg(args, "id", "seriesId", "series_id")
        require_parent = args.get("_require_parent_task_id")
        values: dict[str, Any] = {
            "seriesId": str(series_raw or ""),
            "requireParentTaskId": str(require_parent) if require_parent else None,
        }
        supplied = set(values)
        if _has_key(args, "name", "title"):
            values["name"] = arg(args, "name", "title")
            supplied.add("name")
        if _has_key(args, "rrule", "RRule"):
            values["rrule"] = arg(args, "rrule", "RRule")
            supplied.add("rrule")
        if _has_key(args, "eventIsAllDay", "isAllDay"):
            values["eventIsAllDay"] = as_bool(arg(args, "eventIsAllDay", "isAllDay"), False)
            supplied.add("eventIsAllDay")
        if _has_key(args, "eventStartTime", "startTime", "start"):
            values["eventStartTime"] = arg(args, "eventStartTime", "startTime", "start")
            supplied.add("eventStartTime")
        if _has_key(args, "eventEndTime", "endTime", "end"):
            values["eventEndTime"] = arg(args, "eventEndTime", "endTime", "end")
            supplied.add("eventEndTime")
        if _has_key(args, "eventLocation", "location"):
            values["eventLocation"] = arg(args, "eventLocation", "location")
            supplied.add("eventLocation")
        if _has_key(args, "eventDescription", "body", "description"):
            values["eventDescription"] = arg(args, "eventDescription", "body", "description")
            supplied.add("eventDescription")
        if _has_key(args, "isActive", "is_active"):
            values["isActive"] = as_bool(arg(args, "isActive", "is_active"), True)
            supplied.add("isActive")
        if _has_key(args, "worksetId", "workset_id"):
            values["worksetId"] = arg(args, "worksetId", "workset_id")
            supplied.add("worksetId")
        return cls(fields_set=frozenset(supplied), **values)

    def with_item_id(self, item_id: str | None) -> RecurringSeriesWriteInput:
        """Store an item id the route already resolved (FK check stays on the route)."""
        return replace(self, itemId=item_id, fields_set=self.fields_set | frozenset({"itemId"}))

    def has_updates(self) -> bool:
        """True when a tool patch carries a business field, not only the series id."""
        return bool(self.fields_set - _RECURRING_IDENTITY_FIELDS)

    def service_kwargs(self) -> dict[str, Any]:
        """Snake_case kwargs for ``create_recurring_series`` / ``patch_recurring_series``."""
        return _service_kwargs(self, _RECURRING_SERVICE_KEYS)


__all__ = [
    "RecurringSeriesWriteInput",
    "UserEventWriteInput",
]
