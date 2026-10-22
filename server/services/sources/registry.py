"""Declarative connect/patch specs for collector platforms.

Mirrors the frontend source-plugin registry: one spec per platform that shares
``connect_source`` → ``finalize_source_setup`` → ``mark_source_connected`` and
``PatchSourceFlow``. Telegram phone/QR/2FA login stays in ``telegram_login``.
Inbound HTTP webhook ingest stays on the messages route.

Collector helpers are looked up on ``manager_sources`` at call time so tests can
stub ``server.collector.manager_sources``.

Platform hook functions and ``*_SOURCE_SPEC`` constants live in sibling modules.
Shared dataclasses, plus ``_update_via`` and ``_keep_display_name``, live in
``registry_types`` so those modules can build specs without importing this
composition root. This module re-exports the names callers already use, checks
spec order against ``COLLECTOR_PLATFORMS``, and runs connect/patch.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Final, NoReturn

from fastapi import Request

from server.api.deps import get_collector, get_db
from server.domain.collector_platforms import COLLECTOR_PLATFORMS
from server.errors import VALIDATION_ERROR, http_error
from server.services.sources.connect import connect_source, finalize_source_setup
from server.services.sources.credentials import parse_credentials
from server.services.sources.patch_flow import PatchSourceFlow, patch_source
from server.services.sources.registry_discord import DISCORD_SOURCE_SPEC
from server.services.sources.registry_email import EMAIL_SOURCE_SPEC
from server.services.sources.registry_http import HTTP_SOURCE_SPEC
from server.services.sources.registry_mqtt import MQTT_SOURCE_SPEC
from server.services.sources.registry_rss import RSS_SOURCE_SPEC
from server.services.sources.registry_types import (
    SourceConnectSpec,
    SourcePatchContext,
    SourceSetupContext,
)
from server.services.sources.registry_types import (
    _keep_display_name as _keep_display_name,
)
from server.services.sources.registry_types import (
    _update_via as _update_via,
)
from server.services.sources.route_helpers import get_source_row
from server.source_status import mark_source_connected


def _reraise_credential_error(spec: SourceConnectSpec, exc: ValueError) -> NoReturn:
    if spec.credential_value_error_is_validation:
        raise http_error(400, str(exc), error_code=VALIDATION_ERROR) from exc
    raise exc


def _patch_context(
    *,
    db: Any,
    source_id: str,
    body: Any,
    row: dict[str, Any],
    merged: dict[str, Any],
    display_name: str,
    result: Any = None,
) -> SourcePatchContext:
    return SourcePatchContext(
        db=db,
        source_id=source_id,
        body=body,
        row=row,
        merged=merged,
        display_name=display_name,
        result=result,
    )


SOURCE_CONNECT_SPECS: Final[tuple[SourceConnectSpec, ...]] = (
    DISCORD_SOURCE_SPEC,
    RSS_SOURCE_SPEC,
    HTTP_SOURCE_SPEC,
    MQTT_SOURCE_SPEC,
    EMAIL_SOURCE_SPEC,
)

_CONNECT_SPEC_ORDER: Final[tuple[str, ...]] = tuple(
    platform for platform in COLLECTOR_PLATFORMS if platform != "telegram"
)

if tuple(spec.platform for spec in SOURCE_CONNECT_SPECS) != _CONNECT_SPEC_ORDER:
    raise RuntimeError(
        "SOURCE_CONNECT_SPECS must follow COLLECTOR_PLATFORMS excluding telegram login "
        f"({tuple(spec.platform for spec in SOURCE_CONNECT_SPECS)!r} != {_CONNECT_SPEC_ORDER!r})"
    )


async def connect_registered_source(request: Request, spec: SourceConnectSpec, body: Any) -> dict[str, Any]:
    """Create a source from ``spec`` and return the existing JSON body."""
    db = get_db(request)
    collector = get_collector(request)
    try:
        credentials = spec.build_credentials(body)
    except ValueError as exc:
        _reraise_credential_error(spec, exc)
    display_name = spec.create_display_name(body, credentials)
    source_id, result, error = await connect_source(
        db,
        collector,
        platform=spec.platform,
        name=display_name,
        credentials=credentials,
        connect=lambda collector, source_id: spec.connect_collector(collector, source_id, credentials, body),
    )
    if error is not None:
        return await spec.connect_error(db, source_id, error)

    async def _finalize() -> dict[str, Any]:
        ctx = SourceSetupContext(
            db=db,
            source_id=source_id,
            body=body,
            credentials=credentials,
            display_name=display_name,
            result=result,
        )
        if spec.after_connect is not None:
            await spec.after_connect(ctx)
        await mark_source_connected(db, source_id, name=spec.connect_name(ctx))
        return await spec.connect_success(ctx)

    return await finalize_source_setup(db, collector, source_id, _finalize)


def _remerge(spec: SourceConnectSpec, body: Any) -> Callable[[dict[str, Any]], dict[str, Any]]:
    def _mutate(current: dict[str, Any]) -> dict[str, Any]:
        return spec.merge_credentials(current, body)

    return _mutate


async def patch_registered_source(
    request: Request,
    spec: SourceConnectSpec,
    source_id: str,
    body: Any,
) -> dict[str, Any]:
    """Patch a source from ``spec`` and return the existing JSON body."""
    db = get_db(request)
    row = await get_source_row(db, source_id)
    if str(row.get("platform")) != spec.platform:
        raise http_error(400, spec.wrong_platform_message, error_code=VALIDATION_ERROR)
    if spec.reject_empty_patch is not None and spec.reject_empty_patch(body):
        raise http_error(400, spec.empty_patch_message, error_code=VALIDATION_ERROR)

    existing = parse_credentials(row)
    try:
        merged = spec.merge_credentials(existing, body)
    except ValueError as exc:
        _reraise_credential_error(spec, exc)
    if spec.validate_merged is not None:
        spec.validate_merged(merged, body, row)
    display_name = str(spec.patch_display_name(body, row, merged))
    if spec.name_only_patch is not None:
        early = await spec.name_only_patch(
            _patch_context(
                db=db,
                source_id=source_id,
                body=body,
                row=row,
                merged=merged,
                display_name=display_name,
            )
        )
        if early is not None:
            return early

    async def _after_success(callback_db: Any, callback_id: str, result: Any) -> None:
        if spec.after_patch is None:
            return
        await spec.after_patch(
            _patch_context(
                db=callback_db,
                source_id=callback_id,
                body=body,
                row=row,
                merged=merged,
                display_name=display_name,
                result=result,
            )
        )

    async def _error_response(callback_db: Any, callback_id: str, error_message: str | None) -> dict[str, Any]:
        return await spec.patch_error(callback_db, callback_id, error_message)

    async def _success_response(callback_db: Any, callback_id: str, result: Any) -> dict[str, Any]:
        return await spec.patch_success(
            _patch_context(
                db=callback_db,
                source_id=callback_id,
                body=body,
                row=row,
                merged=merged,
                display_name=display_name,
                result=result,
            )
        )

    return await patch_source(
        request,
        source_id,
        PatchSourceFlow(
            display_name=display_name,
            merged_credentials=merged,
            update_collector=spec.update_collector,
            after_success=_after_success,
            error_response=_error_response,
            success_response=_success_response,
            platform_label=spec.platform_label,
            mutate_credentials=_remerge(spec, body) if spec.remerge_on_patch else None,
        ),
    )
