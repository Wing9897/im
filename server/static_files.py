"""Production static file serving with SPA fallback.

The Electron shell loads http://localhost:18820 directly in production, so the
FastAPI process must serve the built frontend (``IM_FRONTEND_DIST``). Hashed
assets get immutable caching; everything else no-cache. Unmatched non-API GET
paths fall back to index.html (client-side routing).
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from starlette.staticfiles import StaticFiles

from server.constants import FRONTEND_DIST_ENV

logger = logging.getLogger(__name__)

#: Vite emits hashed filenames like ``index-BX3yq2Yp.js``.
_HASHED_ASSET_RE = re.compile(r"-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|svg|jpg)$")


class _CachedStaticFiles(StaticFiles):
    """StaticFiles with cache-control tuned for hashed vs plain assets."""

    def file_response(self, *args, **kwargs):  # type: ignore[override]
        response = super().file_response(*args, **kwargs)
        path = str(args[0]) if args else ""
        if _HASHED_ASSET_RE.search(path):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response


def resolve_frontend_dist() -> Path | None:
    """Locate the built frontend: env var first, then the sibling web/dist."""
    env_value = os.environ.get(FRONTEND_DIST_ENV)
    candidates = []
    if env_value:
        candidates.append(Path(env_value))
    candidates.append(Path(__file__).resolve().parent.parent / "web" / "dist")
    for candidate in candidates:
        if (candidate / "index.html").is_file():
            return candidate
    return None


def mount_static_files(app: FastAPI) -> bool:
    """Mount the SPA if a build exists. Returns True when mounted."""
    dist = resolve_frontend_dist()
    if dist is None:
        logger.info("No frontend build found; static file serving disabled (dev mode)")
        return False

    index_file = dist / "index.html"

    if (dist / "assets").is_dir():
        app.mount("/assets", _CachedStaticFiles(directory=str(dist / "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    async def spa_index() -> FileResponse:
        return FileResponse(index_file, headers={"Cache-Control": "no-cache"})

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path == "health" or full_path.startswith("api/"):
            # Let unmatched API paths 404 as JSON, not as index.html.
            # Real health lives under /api/v1/health (registered route).
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Not found")
        candidate = (dist / full_path).resolve()
        # Serve real files at the dist root (favicon etc.); anything else → SPA.
        if candidate.is_file() and str(candidate).startswith(str(dist.resolve())):
            headers = {
                "Cache-Control": "public, max-age=31536000, immutable"
                if _HASHED_ASSET_RE.search(candidate.name)
                else "no-cache"
            }
            return FileResponse(candidate, headers=headers)
        return FileResponse(index_file, headers={"Cache-Control": "no-cache"})

    logger.info("Serving frontend from %s", dist)
    return True
