"""Intelligence Monitor backend (v3 clean rebuild).

Single-process FastAPI application serving the React frontend contract:
REST /api/v1/* + SSE /api/v1/events + static SPA files in production.
"""

from server.version import __version__

__all__ = ["__version__"]
