"""Authentication and access-key request models."""

from pydantic import BaseModel, ConfigDict, Field


class AccessKeyCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(default="Access key", max_length=80)
    readOnly: bool = Field(
        default=False,
        description=(
            'When true, create a read-only key (`["read"]`) for GET-only remote access. '
            'Leave false for a full household key (`["*"]`) usable for writes, Webhook, '
            "agent/chat, and A2A."
        ),
    )
    scopes: list[str] | None = Field(
        default=None,
        description=(
            "Optional explicit scopes. When set, overrides `readOnly`. "
            'Use `["*"]` for full access or `["read"]` for read-only.'
        ),
    )


class RegisterBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1)
    label: str = Field(default="Host", max_length=80)


class LoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1)
    label: str = Field(default="Device", max_length=80)


class ChangePasswordBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=1)


class ResetPasswordBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=64)
    newPassword: str = Field(min_length=1)


class RefreshBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refreshToken: str = Field(min_length=1, max_length=512)


class RotateSecretsBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1)
