"""Actions routes: CRUD, toggle, manual test."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from server.api.deps import (
    API_DEPS,
    get_action_executor,
    get_db,
    publish_resource_modified,
)
from server.api.schemas.requests import ActionBody
from server.api.schemas.responses import (
    ActionResponse,
    ActionTestResponse,
    ActionToggleResponse,
    ActionTriggerHistoryPageResponse,
)
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries import actions_queries
from server.services import actions_crud
from server.services.actions_crud import ActionValidationError
from server.wire.serializers import serialize_action, serialize_action_trigger_history

router = APIRouter(prefix="/api/v1/actions", tags=["actions"], dependencies=API_DEPS)


def _notify(request: Request, action_id: str, action: str) -> None:
    publish_resource_modified(request, "action", action_id, action)


def _map_validation(exc: ActionValidationError) -> None:
    message = str(exc)
    if "not found" in message.lower():
        raise http_error(404, message, error_code=NOT_FOUND) from exc
    raise http_error(422, message, error_code=VALIDATION_ERROR) from exc


# ── CRUD ─────────────────────────────────────────────────────────────────


@router.get("", response_model=list[ActionResponse])
async def list_actions(request: Request) -> list[ActionResponse]:
    db = get_db(request)
    rows = await actions_queries.fetch_all_action_rows(db)
    return [ActionResponse.model_validate(serialize_action(row)) for row in rows]


@router.get("/trigger-history", response_model=ActionTriggerHistoryPageResponse)
async def list_trigger_history(
    request: Request,
    action_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> ActionTriggerHistoryPageResponse:
    db = get_db(request)
    rows, total_count, has_more = await actions_queries.fetch_trigger_history_page(
        db,
        action_id=action_id,
        limit=limit,
        offset=offset,
    )
    return ActionTriggerHistoryPageResponse.model_validate(
        {
            "items": [serialize_action_trigger_history(row) for row in rows],
            "totalCount": total_count,
            "hasMore": has_more,
        }
    )


@router.post("", status_code=201, response_model=ActionResponse)
async def create_action(request: Request, body: ActionBody) -> ActionResponse:
    try:
        result = await actions_crud.create_action(
            get_db(request),
            name=body.name,
            action_type=body.actionType,
            configuration=body.configuration,
            trigger_conditions=body.triggerConditions,
        )
    except ActionValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify(request, str(result["id"]), "created")
    return ActionResponse.model_validate(result)


@router.put("/{action_id}", response_model=ActionResponse)
async def update_action(request: Request, action_id: str, body: ActionBody) -> ActionResponse:
    try:
        result = await actions_crud.update_action(
            get_db(request),
            action_id,
            name=body.name,
            action_type=body.actionType,
            configuration=body.configuration,
            trigger_conditions=body.triggerConditions,
        )
    except ActionValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify(request, action_id, "updated")
    return ActionResponse.model_validate(result)


@router.delete("/{action_id}", status_code=204)
async def delete_action(request: Request, action_id: str) -> Response:
    try:
        await actions_crud.delete_action(get_db(request), action_id)
    except ActionValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify(request, action_id, "deleted")
    return Response(status_code=204)


@router.patch("/{action_id}/toggle", response_model=ActionToggleResponse)
async def toggle_action(request: Request, action_id: str) -> ActionToggleResponse:
    try:
        result = await actions_crud.toggle_action(get_db(request), action_id)
    except ActionValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    _notify(request, action_id, "updated")
    return ActionToggleResponse.model_validate(result)


@router.post(
    "/{action_id}/test",
    response_model=ActionTestResponse,
    response_model_exclude_none=True,
)
async def test_action(request: Request, action_id: str) -> ActionTestResponse:
    try:
        result = await actions_crud.test_action(
            get_db(request),
            get_action_executor(request),
            action_id,
        )
    except ActionValidationError as exc:
        _map_validation(exc)
        raise  # pragma: no cover
    return ActionTestResponse.model_validate(result)
