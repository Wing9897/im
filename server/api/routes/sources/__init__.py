"""Sources route package: CRUD + Telegram login + Discord/RSS/HTTP/MQTT/Email sources.

The shared ``router`` lives in ``common``; importing the platform modules
below registers their endpoints on it. List responses are polymorphic by
``?platform`` and also exposed as typed ``GET /sources/{telegram,discord,rss,http,mqtt,email}``.
"""

from __future__ import annotations

from server.api.routes.sources import discord, email, feeds, http, telegram  # noqa: F401 — endpoint registration
from server.api.routes.sources.common import router

__all__ = ["router"]
