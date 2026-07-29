"""Setup, device-session, and access-key response models."""

from __future__ import annotations

from pydantic import BaseModel, Field

_SCOPES_DESCRIPTION = 'Capability scopes; `["*"]` = full household, `["a2a:agent"]` = A2A-only.'


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
