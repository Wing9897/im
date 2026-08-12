"""Theme helpers — focal / daily background metadata + image byte proxy."""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import Response

from server.api.deps import API_DEPS
from server.api.schemas.responses.theme import FocalBackgroundResponse
from server.services.focal_background import (
    fetch_focal_background,
    fetch_focal_background_image,
)

router = APIRouter(
    prefix="/api/v1/theme",
    tags=["theme"],
    dependencies=API_DEPS,
)


@router.get("/focal-background", response_model=FocalBackgroundResponse)
async def focal_background(
    locale: str | None = Query(
        default=None,
        max_length=32,
        description="UI locale (en / zh-Hans / zh-Hant) or Bing mkt (en-US).",
    ),
    idx: int = Query(
        default=0,
        ge=0,
        le=7,
        description="Bing HPImageArchive idx: 0=today, 1=yesterday, … up to 7.",
    ),
) -> FocalBackgroundResponse:
    """Proxy Bing HPImageArchive JSON; returns absolute https image URL + credits."""
    return await fetch_focal_background(locale, idx=idx)


@router.get("/focal-background/image")
async def focal_background_image(
    locale: str | None = Query(
        default=None,
        max_length=32,
        description="UI locale (en / zh-Hans / zh-Hant) or Bing mkt (en-US).",
    ),
    idx: int = Query(
        default=0,
        ge=0,
        le=7,
        description="Bing HPImageArchive idx: 0=today, 1=yesterday, … up to 7.",
    ),
) -> Response:
    """Proxy Bing wallpaper bytes for same-origin CSS / preview use."""
    body, media_type = await fetch_focal_background_image(locale, idx=idx)
    return Response(
        content=body,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
