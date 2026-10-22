"""HTTP poll sources: create and update.

Inbound webhook message creation stays on ``POST /api/v1/messages``.
"""

from __future__ import annotations

from fastapi import Request

from server.api.routes.sources.common import router
from server.api.schemas.requests.sources import HttpSourceBody, HttpSourcePatchBody
from server.api.schemas.responses import AddHttpSourceResponse
from server.services.sources.registry import HTTP_SOURCE_SPEC, connect_registered_source, patch_registered_source


@router.post("/http", response_model=AddHttpSourceResponse)
async def create_http_source(request: Request, body: HttpSourceBody) -> dict:
    return await connect_registered_source(request, HTTP_SOURCE_SPEC, body)


@router.patch("/http/{source_id}", response_model=AddHttpSourceResponse)
async def update_http_source(request: Request, source_id: str, body: HttpSourcePatchBody) -> dict:
    return await patch_registered_source(request, HTTP_SOURCE_SPEC, source_id, body)
