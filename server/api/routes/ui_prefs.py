"""UI prefs routes: ops board + local-notify JSON in ``ui_prefs``.

Board resource combines layout + widgetState in one GET/PUT (fewer roundtrips
on hydrate). Local notify is split into three resources so the scanner can
rewrite fired/history without touching settings.

Stamp 37: SoT paths are ``/api/v1/ui-prefs/notify/{settings,fired,history}``.
Retired ``/api/v1/ui-prefs/voice-reminder/*`` is absent (404).
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
    NotifyFiredBody,
    NotifyFiredClaimResponse,
    NotifyFiredResponse,
    NotifyHistoryBody,
    NotifyHistoryResponse,
    NotifySettingsBody,
    NotifySettingsResponse,
    TimelineAnnotationsPutBody,
    TimelineAnnotationsResponse,
)
from server.errors import VALIDATION_ERROR, http_error
from server.ui_prefs import (
    UiPrefsValidationError,
    claim_notify_fired,
    get_assistant_sessions,
    get_assistant_voice_io,
    get_board_prefs,
    get_notify_fired,
    get_notify_history,
    get_notify_settings,
    get_timeline_annotations,
    put_assistant_sessions,
    put_assistant_voice_io,
    put_board_prefs,
    put_notify_fired,
    put_notify_history,
    put_notify_settings,
    put_timeline_annotations,
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
async def fetch_board_prefs(request: Request) -> BoardPrefsResponse:
    return BoardPrefsResponse.model_validate(await get_board_prefs(get_db(request)))


@router.put("/board", response_model=BoardPrefsResponse)
async def save_board_prefs(request: Request, body: BoardPrefsPutBody) -> BoardPrefsResponse:
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
        saved = await put_board_prefs(
            get_db(request),
            layout=_board_put_arg(body, "layout"),
            widget_state=_board_put_arg(body, "widgetState"),
        )
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
    return BoardPrefsResponse.model_validate(saved)


@router.get("/notify/settings", response_model=NotifySettingsResponse)
async def fetch_notify_settings(request: Request) -> NotifySettingsResponse:
    return NotifySettingsResponse.model_validate(await get_notify_settings(get_db(request)))


@router.put("/notify/settings", response_model=NotifySettingsResponse)
async def save_notify_settings(request: Request, body: NotifySettingsBody) -> NotifySettingsResponse:
    try:
        saved = await put_notify_settings(get_db(request), body.settings.model_dump(exclude_unset=True))
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
    return NotifySettingsResponse.model_validate(saved)


@router.get("/notify/fired", response_model=NotifyFiredResponse)
async def fetch_notify_fired(request: Request) -> NotifyFiredResponse:
    return NotifyFiredResponse.model_validate(await get_notify_fired(get_db(request)))


@router.put("/notify/fired", response_model=NotifyFiredResponse)
async def save_notify_fired(request: Request, body: NotifyFiredBody) -> NotifyFiredResponse:
    try:
        saved = await put_notify_fired(get_db(request), body.keys)
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
    return NotifyFiredResponse.model_validate(saved)


@router.post("/notify/fired/claim", response_model=NotifyFiredClaimResponse)
async def claim_notify_fired_route(request: Request, body: NotifyFiredBody) -> NotifyFiredClaimResponse:
    """Reserve dedupe keys before TTS so only one client speaks per reminder."""
    try:
        claimed = await claim_notify_fired(get_db(request), body.keys)
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
    return NotifyFiredClaimResponse.model_validate(claimed)


@router.get("/notify/history", response_model=NotifyHistoryResponse)
async def fetch_notify_history(request: Request) -> NotifyHistoryResponse:
    return NotifyHistoryResponse.model_validate(await get_notify_history(get_db(request)))


@router.put("/notify/history", response_model=NotifyHistoryResponse)
async def save_notify_history(request: Request, body: NotifyHistoryBody) -> NotifyHistoryResponse:
    try:
        saved = await put_notify_history(
            get_db(request),
            [entry.model_dump(exclude_none=True) for entry in body.entries],
        )
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
    return NotifyHistoryResponse.model_validate(saved)


@router.get("/assistant/sessions", response_model=AssistantSessionsResponse)
async def fetch_assistant_sessions(request: Request, deviceId: str) -> AssistantSessionsResponse:
    """Chat session list + active id for one client device slot."""
    if not deviceId or not deviceId.strip():
        raise http_error(
            422,
            "deviceId query parameter is required",
            error_code=VALIDATION_ERROR,
        )
    try:
        sessions = await get_assistant_sessions(get_db(request), deviceId)
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
    return AssistantSessionsResponse.model_validate(sessions)


@router.put("/assistant/sessions", response_model=AssistantSessionsResponse)
async def save_assistant_sessions(request: Request, body: AssistantSessionsPutBody) -> AssistantSessionsResponse:
    if not body.deviceId.strip():
        raise http_error(422, "deviceId is required", error_code=VALIDATION_ERROR)
    try:
        saved = await put_assistant_sessions(
            get_db(request),
            body.deviceId,
            body.model_dump(exclude_none=True),
        )
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
    return AssistantSessionsResponse.model_validate(saved)


@router.get("/assistant/voice-io", response_model=AssistantVoiceIoResponse)
async def fetch_assistant_voice_io(request: Request) -> AssistantVoiceIoResponse:
    return AssistantVoiceIoResponse.model_validate(await get_assistant_voice_io(get_db(request)))


@router.put("/assistant/voice-io", response_model=AssistantVoiceIoResponse)
async def save_assistant_voice_io(request: Request, body: AssistantVoiceIoBody) -> AssistantVoiceIoResponse:
    try:
        saved = await put_assistant_voice_io(get_db(request), body.settings.model_dump(exclude_unset=True))
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
    return AssistantVoiceIoResponse.model_validate(saved)


@router.get("/timeline/annotations", response_model=TimelineAnnotationsResponse)
async def fetch_timeline_annotations(request: Request) -> TimelineAnnotationsResponse:
    """Client eventStatuses + eventTimeOverrides (not soft-dismiss)."""
    return TimelineAnnotationsResponse.model_validate(await get_timeline_annotations(get_db(request)))


@router.put("/timeline/annotations", response_model=TimelineAnnotationsResponse)
async def save_timeline_annotations(
    request: Request,
    body: TimelineAnnotationsPutBody,
) -> TimelineAnnotationsResponse:
    try:
        saved = await put_timeline_annotations(get_db(request), body.model_dump())
    except UiPrefsValidationError as exc:
        raise _http_from_validation(exc) from exc
    return TimelineAnnotationsResponse.model_validate(saved)

