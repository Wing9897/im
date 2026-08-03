"""UI prefs routes: ops board + voice reminder JSON in ``system_config``.

Board resource combines layout + widgetState in one GET/PUT (fewer roundtrips
on hydrate). Voice reminder is split into three resources so the scanner can
rewrite fired/history without touching settings.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.deps import API_DEPS, get_db
from server.api.schemas.responses import (
    AssistantSessionsPutBody,
    AssistantSessionsResponse,
    AssistantVoiceIoBody,
    AssistantVoiceIoResponse,
    BoardPrefsPutBody,
    BoardPrefsResponse,
    TimelineAnnotationsPutBody,
    TimelineAnnotationsResponse,
    VoiceFiredBody,
    VoiceHistoryBody,
    VoiceReminderFiredClaimResponse,
    VoiceReminderFiredResponse,
    VoiceReminderHistoryResponse,
    VoiceReminderSettingsResponse,
    VoiceSettingsBody,
)
from server.errors import VALIDATION_ERROR, http_error
from server.ui_prefs import (
    UiPrefsValidationError,
    claim_voice_fired,
    get_assistant_sessions,
    get_assistant_voice_io,
    get_board_prefs,
    get_timeline_annotations,
    get_voice_fired,
    get_voice_history,
    get_voice_settings,
    put_assistant_sessions,
    put_assistant_voice_io,
    put_board_prefs,
    put_timeline_annotations,
    put_voice_fired,
    put_voice_history,
    put_voice_settings,
)

router = APIRouter(prefix="/api/v1/ui-prefs", tags=["ui-prefs"], dependencies=API_DEPS)


def _http_from_validation(exc: UiPrefsValidationError):
    return http_error(422, str(exc), error_code=VALIDATION_ERROR)


def _board_put_arg(body: BoardPrefsPutBody, field: str) -> Any:
    """Ellipsis = omit (leave unchanged); ``None`` clears; otherwise dump model."""
    if field not in body.model_fields_set:
        return ...
    value = getattr(body, field)
    if value is None:
        return None
    # Keep explicit nulls inside widgetState.sourceFilters (null = all sources).
    return value.model_dump()


@router.get("/board", response_model=BoardPrefsResponse)
async def fetch_board_prefs(request: Request) -> dict:
    return await get_board_prefs(get_db(request))


@router.put("/board", response_model=BoardPrefsResponse)
async def save_board_prefs(request: Request, body: BoardPrefsPutBody) -> dict:
    """Persist board layout and/or widget state.

    Accepted keys: ``layout``, ``widgetState``. Omitted keys are left unchanged;
    explicit ``null`` clears that ``system_config`` key.
    """
    if "layout" not in body.model_fields_set and "widgetState" not in body.model_fields_set:
        raise http_error(
            422,
            "Provide layout and/or widgetState",
            error_code=VALIDATION_ERROR,
        )
    try:
        return await put_board_prefs(
            get_db(request),
            layout=_board_put_arg(body, "layout"),
            widget_state=_board_put_arg(body, "widgetState"),
        )
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.get("/voice-reminder/settings", response_model=VoiceReminderSettingsResponse)
async def fetch_voice_settings(request: Request) -> dict:
    return await get_voice_settings(get_db(request))


@router.put("/voice-reminder/settings", response_model=VoiceReminderSettingsResponse)
async def save_voice_settings(request: Request, body: VoiceSettingsBody) -> dict:
    try:
        return await put_voice_settings(get_db(request), body.settings.model_dump(exclude_unset=True))
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.get("/voice-reminder/fired", response_model=VoiceReminderFiredResponse)
async def fetch_voice_fired(request: Request) -> dict:
    return await get_voice_fired(get_db(request))


@router.put("/voice-reminder/fired", response_model=VoiceReminderFiredResponse)
async def save_voice_fired(request: Request, body: VoiceFiredBody) -> dict:
    try:
        return await put_voice_fired(get_db(request), body.keys)
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.post("/voice-reminder/fired/claim", response_model=VoiceReminderFiredClaimResponse)
async def claim_voice_fired_route(request: Request, body: VoiceFiredBody) -> dict:
    """Reserve dedupe keys before TTS so only one client speaks per reminder."""
    try:
        return await claim_voice_fired(get_db(request), body.keys)
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.get("/voice-reminder/history", response_model=VoiceReminderHistoryResponse)
async def fetch_voice_history(request: Request) -> dict:
    return await get_voice_history(get_db(request))


@router.put("/voice-reminder/history", response_model=VoiceReminderHistoryResponse)
async def save_voice_history(request: Request, body: VoiceHistoryBody) -> dict:
    try:
        return await put_voice_history(
            get_db(request),
            [entry.model_dump(exclude_none=True) for entry in body.entries],
        )
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.get("/assistant/sessions", response_model=AssistantSessionsResponse)
async def fetch_assistant_sessions(request: Request, deviceId: str) -> dict:
    """Chat session list + active id for one client device slot."""
    if not deviceId or not deviceId.strip():
        raise http_error(
            422,
            "deviceId query parameter is required",
            error_code=VALIDATION_ERROR,
        )
    try:
        return await get_assistant_sessions(get_db(request), deviceId)
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.put("/assistant/sessions", response_model=AssistantSessionsResponse)
async def save_assistant_sessions(request: Request, body: AssistantSessionsPutBody) -> dict:
    if not body.deviceId.strip():
        raise http_error(422, "deviceId is required", error_code=VALIDATION_ERROR)
    try:
        return await put_assistant_sessions(
            get_db(request),
            body.deviceId,
            body.model_dump(exclude_none=True),
        )
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.get("/assistant/voice-io", response_model=AssistantVoiceIoResponse)
async def fetch_assistant_voice_io(request: Request) -> dict:
    return await get_assistant_voice_io(get_db(request))


@router.put("/assistant/voice-io", response_model=AssistantVoiceIoResponse)
async def save_assistant_voice_io(request: Request, body: AssistantVoiceIoBody) -> dict:
    try:
        return await put_assistant_voice_io(get_db(request), body.settings.model_dump(exclude_unset=True))
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc


@router.get("/timeline/annotations", response_model=TimelineAnnotationsResponse)
async def fetch_timeline_annotations(request: Request) -> dict:
    """Client eventStatuses + eventTimeOverrides (not soft-dismiss)."""
    return await get_timeline_annotations(get_db(request))


@router.put("/timeline/annotations", response_model=TimelineAnnotationsResponse)
async def save_timeline_annotations(request: Request, body: TimelineAnnotationsPutBody) -> dict:
    try:
        return await put_timeline_annotations(get_db(request), body.model_dump())
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
