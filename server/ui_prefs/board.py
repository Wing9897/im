"""Ops board layout + widgetState prefs."""

from __future__ import annotations

from typing import Any, Mapping

from server.db.database import Database
from server.ui_prefs.common import (
    KEY_OPS_BOARD_LAYOUT,
    KEY_OPS_BOARD_WIDGET_STATE,
    SOURCE_FILTER_INVALID,
    UiPrefsValidationError,
    _delete_json,
    _read_json,
    _sanitize_source_filter_shape,
    _write_json,
)

# Design: GET/PUT ``/api/v1/ui-prefs/board`` carries both ``layout`` and
# ``widgetState`` together to avoid two roundtrips on hydrate/normalize.
# Partial PUT is allowed (omit a field to leave that key unchanged); send
# ``null`` to clear a key. ``configured`` is true when either key has data.


def sanitize_board_layout(raw: Any) -> dict[str, Any]:
    """Light structural sanitize; deep widget rules stay on the client."""
    if not isinstance(raw, Mapping):
        raise UiPrefsValidationError("layout must be an object")
    version = raw.get("version")
    widgets = raw.get("widgets")
    if not isinstance(version, int):
        raise UiPrefsValidationError("layout.version must be an integer")
    if not isinstance(widgets, list):
        raise UiPrefsValidationError("layout.widgets must be an array")
    clean_widgets: list[dict[str, Any]] = []
    for item in widgets:
        if not isinstance(item, Mapping):
            continue
        widget_id = item.get("i")
        widget_type = item.get("type")
        if not isinstance(widget_id, str) or not widget_id.strip():
            continue
        if not isinstance(widget_type, str) or not widget_type.strip():
            continue
        entry: dict[str, Any] = {
            "i": widget_id.strip(),
            "type": widget_type.strip(),
        }
        for coord_key in ("col", "row"):
            coord = item.get(coord_key)
            if isinstance(coord, bool) or not isinstance(coord, (int, float)):
                raise UiPrefsValidationError(f"layout.widgets[].{coord_key} must be a number")
            entry[coord_key] = int(coord)
        size_id = item.get("sizeId")
        if not isinstance(size_id, str) or not size_id.strip():
            raise UiPrefsValidationError("layout.widgets[].sizeId must be a string")
        entry["sizeId"] = size_id.strip()
        z = item.get("z")
        if z is not None:
            if isinstance(z, bool) or not isinstance(z, (int, float)):
                raise UiPrefsValidationError("layout.widgets[].z must be a number")
            entry["z"] = int(z)
        clean_widgets.append(entry)
    return {"version": version, "widgets": clean_widgets}


def sanitize_board_widget_state(raw: Any) -> dict[str, Any]:
    """Sanitize ``{ mapViews, sourceFilters, ganttViewModes }`` per plan shape."""
    if not isinstance(raw, Mapping):
        raise UiPrefsValidationError("widgetState must be an object")
    map_views_raw = raw.get("mapViews", {})
    source_filters_raw = raw.get("sourceFilters", {})
    gantt_modes_raw = raw.get("ganttViewModes", {})
    if not isinstance(map_views_raw, Mapping):
        raise UiPrefsValidationError("widgetState.mapViews must be an object")
    if not isinstance(source_filters_raw, Mapping):
        raise UiPrefsValidationError("widgetState.sourceFilters must be an object")
    if not isinstance(gantt_modes_raw, Mapping):
        raise UiPrefsValidationError("widgetState.ganttViewModes must be an object")

    map_views: dict[str, Any] = {}
    for widget_id, view in map_views_raw.items():
        if not isinstance(widget_id, str) or not widget_id.strip():
            continue
        if not isinstance(view, Mapping):
            continue
        center = view.get("center")
        zoom = view.get("zoom")
        if (
            not isinstance(center, list)
            or len(center) != 2
            or not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in center)
            or not isinstance(zoom, (int, float))
            or isinstance(zoom, bool)
        ):
            continue
        map_views[widget_id.strip()] = {
            "center": [float(center[0]), float(center[1])],
            "zoom": float(zoom),
        }

    source_filters: dict[str, Any] = {}
    for widget_id, ids in source_filters_raw.items():
        if not isinstance(widget_id, str) or not widget_id.strip():
            continue
        key = widget_id.strip()
        cleaned = _sanitize_source_filter_shape(ids)
        if cleaned is SOURCE_FILTER_INVALID:
            # Flat string[] / bad shape → drop (hard-cut; no silent upgrade).
            continue
        source_filters[key] = cleaned

    gantt_view_modes: dict[str, str] = {}
    for widget_id, mode in gantt_modes_raw.items():
        if not isinstance(widget_id, str) or not widget_id.strip():
            continue
        if mode in ("day", "month"):
            gantt_view_modes[widget_id.strip()] = mode

    return {
        "mapViews": map_views,
        "sourceFilters": source_filters,
        "ganttViewModes": gantt_view_modes,
    }


async def get_board_prefs(db: Database) -> dict[str, Any]:
    layout = await _read_json(db, KEY_OPS_BOARD_LAYOUT)
    widget_state = await _read_json(db, KEY_OPS_BOARD_WIDGET_STATE)
    if isinstance(widget_state, Mapping):
        widget_state = sanitize_board_widget_state(widget_state)
    elif widget_state is not None:
        widget_state = None
    configured = layout is not None or widget_state is not None
    return {
        "configured": configured,
        "layout": layout if isinstance(layout, dict) else None,
        "widgetState": widget_state if isinstance(widget_state, dict) else None,
    }


async def put_board_prefs(
    db: Database,
    *,
    layout: Any = ...,
    widget_state: Any = ...,
) -> dict[str, Any]:
    """Upsert board prefs. Ellipsis = leave unchanged; ``None`` = clear key."""
    if layout is ... and widget_state is ...:
        raise UiPrefsValidationError("Provide layout and/or widgetState")

    if layout is not ...:
        if layout is None:
            await _delete_json(db, KEY_OPS_BOARD_LAYOUT)
        else:
            await _write_json(db, KEY_OPS_BOARD_LAYOUT, sanitize_board_layout(layout))
    if widget_state is not ...:
        if widget_state is None:
            await _delete_json(db, KEY_OPS_BOARD_WIDGET_STATE)
        else:
            await _write_json(db, KEY_OPS_BOARD_WIDGET_STATE, sanitize_board_widget_state(widget_state))
    return await get_board_prefs(db)
