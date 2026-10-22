"""Shared connect/patch types for collector source specs.

Platform modules import these types, and the helpers their specs close over,
from here. Importing them from ``registry`` would cycle: that module composes
the specs.

``_update_via`` looks up collector helpers on ``manager_sources`` at call time
so tests can stub ``server.collector.manager_sources``.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from server.collector import manager_sources

_CredentialsFn = Callable[[Any], dict[str, Any]]
_MergeFn = Callable[[dict[str, Any], Any], dict[str, Any]]
_ConnectCollector = Callable[[Any, str, dict[str, Any], Any], Awaitable[dict[str, Any]]]
_UpdateCollector = Callable[[Any, str, dict[str, Any]], Awaitable[Any]]


@dataclass(frozen=True, slots=True)
class SourceSetupContext:
    """Values available while finalizing a successful connect."""

    db: Any
    source_id: str
    body: Any
    credentials: dict[str, Any]
    display_name: str
    result: Any


@dataclass(frozen=True, slots=True)
class SourcePatchContext:
    """Values available while applying a source PATCH."""

    db: Any
    source_id: str
    body: Any
    row: dict[str, Any]
    merged: dict[str, Any]
    display_name: str
    result: Any = None


@dataclass(frozen=True, slots=True)
class SourceConnectSpec:
    """Connect and patch hooks for one collector platform.

    ``credential_value_error_is_validation`` maps ``ValueError`` from credential
    build/merge to HTTP 400 (HTTP poll). Other platforms let it propagate.
    ``remerge_on_patch`` re-applies ``merge_credentials`` inside the credential
    transaction (Discord, Email). Otherwise the precomputed merge is stored.
    ``connect_name`` returning ``None`` marks connected without renaming.
    """

    platform: str
    platform_label: str
    wrong_platform_message: str
    build_credentials: _CredentialsFn
    create_display_name: Callable[[Any, dict[str, Any]], str]
    connect_collector: _ConnectCollector
    update_collector: _UpdateCollector
    merge_credentials: _MergeFn
    patch_display_name: Callable[[Any, dict[str, Any], dict[str, Any]], str]
    connect_name: Callable[[SourceSetupContext], str | None]
    connect_error: Callable[[Any, str, str], Awaitable[dict[str, Any]]]
    connect_success: Callable[[SourceSetupContext], Awaitable[dict[str, Any]]]
    patch_error: Callable[[Any, str, str | None], Awaitable[dict[str, Any]]]
    patch_success: Callable[[SourcePatchContext], Awaitable[dict[str, Any]]]
    after_connect: Callable[[SourceSetupContext], Awaitable[None]] | None = None
    after_patch: Callable[[SourcePatchContext], Awaitable[None]] | None = None
    validate_merged: Callable[[dict[str, Any], Any, dict[str, Any]], None] | None = None
    reject_empty_patch: Callable[[Any], bool] | None = None
    empty_patch_message: str = ""
    name_only_patch: Callable[[SourcePatchContext], Awaitable[dict[str, Any] | None]] | None = None
    remerge_on_patch: bool = False
    credential_value_error_is_validation: bool = False


def _update_via(method_name: str) -> _UpdateCollector:
    async def _update(collector: Any, source_id: str, credentials: dict[str, Any]) -> Any:
        update = getattr(manager_sources, method_name)
        return await update(collector, source_id, credentials)

    return _update


def _keep_display_name(ctx: SourceSetupContext) -> str | None:
    return ctx.display_name
