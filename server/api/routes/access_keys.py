"""Household access keys (LAN, webhook, multi-device)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

from server.access_keys import A2A_LIAISON_SCOPES, create_access_key, list_access_keys_public, revoke_access_key
from server.api.deps import API_DEPS, get_db
from server.api.schemas.responses import (
    AccessKeyCreatedResponse,
    AccessKeyDeleteResponse,
    AccessKeyListResponse,
)
from server.errors import NOT_FOUND, VALIDATION_ERROR, http_error

router = APIRouter(prefix="/api/v1/access-keys", tags=["access-keys"], dependencies=API_DEPS)


class AccessKeyCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(default="Access key", max_length=80)
    allowA2aAgent: bool = Field(
        default=False,
        description=(
            'When true, create an A2A-only key (`["a2a:agent"]`) for '
            "`POST /api/v1/a2a/agent` only. Leave false for a full household key "
            '(`["*"]`) usable for Webhook, agent/chat, and A2A.'
        ),
    )
    scopes: list[str] | None = Field(
        default=None,
        description=(
            "Optional explicit scopes. When set, overrides `allowA2aAgent`. "
            'Use `["*"]` for full access or `["a2a:agent"]` for A2A-only. '
            "Non-`*` keys are limited to `/api/v1/a2a/`."
        ),
    )


@router.get("", response_model=AccessKeyListResponse)
async def fetch_access_keys(request: Request) -> dict[str, Any]:
    keys = await list_access_keys_public(get_db(request))
    return {"keys": keys}


@router.post("", response_model=AccessKeyCreatedResponse)
async def add_access_key(request: Request, body: AccessKeyCreateBody) -> dict[str, Any]:
    if body.scopes is not None:
        scopes = body.scopes
    elif body.allowA2aAgent:
        scopes = list(A2A_LIAISON_SCOPES)
    else:
        scopes = None
    try:
        return await create_access_key(get_db(request), body.label, scopes=scopes)
    except ValueError as exc:
        raise http_error(422, str(exc), error_code=VALIDATION_ERROR) from exc


@router.delete("/{key_id}", response_model=AccessKeyDeleteResponse)
async def delete_access_key(request: Request, key_id: str) -> dict[str, bool]:
    removed = await revoke_access_key(get_db(request), key_id)
    if not removed:
        raise http_error(404, "Access key not found", error_code=NOT_FOUND)
    return {"ok": True}
