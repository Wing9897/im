"""Route group registry.

Every module in this package exposes a ``router``; :func:`all_routers` returns
them in mount order. The public health routes live in ``health`` (no auth).
"""

from __future__ import annotations

from fastapi import APIRouter

from server.api.routes import health


def all_routers() -> list[APIRouter]:
    routers: list[APIRouter] = [health.router]

    from server.api.routes import (
        a2a_agent,
        access_keys,
        actions,
        agent,
        calendar,
        channels,
        config,
        events,
        items,
        logs,
        messages,
        results,
        setup,
        sources,
        system,
        tasks,
        ui_prefs,
        viewer,
        weather,
        worksets,
    )

    routers.extend(
        [
            setup.router,
            tasks.router,
            worksets.router,
            items.router,
            sources.router,
            results.router,
            messages.router,
            channels.router,
            config.router,
            access_keys.router,
            a2a_agent.router,
            # Public reset (conditional auth) before the authenticated system router.
            system.public_reset_router,
            system.router,
            actions.router,
            calendar.router,
            ui_prefs.router,
            logs.router,
            viewer.router,
            events.router,
            agent.router,
            weather.router,
        ]
    )
    return routers
