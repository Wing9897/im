"""Setup, device-session, and access-key response models."""

from __future__ import annotations

from pydantic import BaseModel, Field

_SCOPES_DESCRIPTION = 'Capability scopes; `["*"]` = full household, `["read"]` = GET-only.'


class SetupOkResponse(BaseModel):
    """Boolean acknowledgement for setup password routes (change / reset)."""

    ok: bool


class SetupStatusResponse(BaseModel):
    bootstrapped: bool
    hasAdmin: bool
    hasActiveDevice: bool
    credentialsConfigured: bool
    localhostAuthExempt: bool
    #: True when ``connection.json`` has ``resetPasswordForLocal: true`` (file-armed rescue).
    resetPasswordForLocal: bool


class DeviceInfoResponse(BaseModel):
    id: str
    label: str
    createdAt: str
    lastSeenAt: str
    expiresAt: str


class DeviceListEntryResponse(DeviceInfoResponse):
    """One row of GET ``/setup/devices``; ``current`` marks the caller's own session."""

    current: bool = False


class DeviceListResponse(BaseModel):
    """GET ``/setup/devices`` — active device sessions for this household."""

    devices: list[DeviceListEntryResponse]


class DeviceSessionTokensResponse(BaseModel):
    accessToken: str
    refreshToken: str
    accessExpiresAt: str
    refreshExpiresAt: str
    device: DeviceInfoResponse


class AccessKeyPublicResponse(BaseModel):
    id: str
    label: str
    preview: str
    createdAt: str
    scopes: list[str] = Field(default=["*"], description=_SCOPES_DESCRIPTION)
    lastUsedAt: str | None = None


class AccessKeyListResponse(BaseModel):
    keys: list[AccessKeyPublicResponse]


class AccessKeyCreatedResponse(BaseModel):
    id: str
    label: str
    preview: str
    createdAt: str
    scopes: list[str] = Field(default=["*"], description=_SCOPES_DESCRIPTION)
    lastUsedAt: str | None = None
    key: str


class AccessKeyDeleteResponse(BaseModel):
    ok: bool
