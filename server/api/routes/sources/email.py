"""Email (IMAP) mailbox sources: create and update."""

from __future__ import annotations

from fastapi import Request

from server.api.routes.sources.common import router
from server.api.schemas.requests import EmailMailboxBody, EmailMailboxPatchBody
from server.api.schemas.responses import AddEmailMailboxResponse
from server.services.sources.registry import EMAIL_SOURCE_SPEC, connect_registered_source, patch_registered_source


@router.post("/email", response_model=AddEmailMailboxResponse)
async def create_email_mailbox(request: Request, body: EmailMailboxBody) -> dict:
    return await connect_registered_source(request, EMAIL_SOURCE_SPEC, body)


@router.patch("/email/{source_id}", response_model=AddEmailMailboxResponse)
async def update_email_mailbox(request: Request, source_id: str, body: EmailMailboxPatchBody) -> dict:
    return await patch_registered_source(request, EMAIL_SOURCE_SPEC, source_id, body)
