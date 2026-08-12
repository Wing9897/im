"""Theme / focal-background response models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FocalBackgroundResponse(BaseModel):
    """Daily focal wallpaper metadata (Bing HPImageArchive via server proxy)."""

    imageUrl: str = Field(min_length=1)
    title: str | None = None
    copyright: str | None = None
    date: str | None = Field(
        default=None,
        description="Bing start date YYYYMMDD when provided by the archive.",
    )
    locale: str = Field(description="Resolved Bing mkt locale (e.g. en-US).")
    source: str = Field(default="bing", description="Upstream provider id.")
