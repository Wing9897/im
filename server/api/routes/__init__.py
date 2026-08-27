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
        calendar_share,
        channels,
        config,
        events,
        items,
        llm,
        logs,
        mcp,
        messages,
        results,
        setup,
        sources,
        system,
        tasks,
        theme,
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
            llm.router,
            items.router,
            sources.router,
            results.router,
            messages.router,
            channels.router,
            config.router,
            access_keys.router,
            a2a_agent.router,
            mcp.router,
            # Public reset (conditional auth) before the authenticated system router.
            system.public_reset_router,
            system.router,
            actions.router,
            calendar.router,
            calendar_share.router,
            ui_prefs.router,
            logs.router,
            viewer.router,
            events.router,
            agent.router,
            weather.router,
            theme.router,
        ]
    )
    return routers
