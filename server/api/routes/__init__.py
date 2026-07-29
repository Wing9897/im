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
        accounts,
        actions,
        agent,
        channels,
        config,
        events,
        logs,
        messages,
        results,
        schema_gate,
        setup,
        system,
        task_assistant,
        tasks,
        timeline_dismissals,
        ui_prefs,
        user_events,
        viewer,
        weather,
    )

    routers.extend(
        [
            schema_gate.router,
            setup.router,
            # task_assistant's fixed /chat-assistant path must mount before
            # tasks' /{task_id} routes.
            task_assistant.router,
            tasks.router,
            accounts.router,
            results.router,
            messages.router,
            channels.router,
            config.router,
            access_keys.router,
            a2a_agent.router,
            system.router,
            actions.router,
            user_events.router,
            timeline_dismissals.router,
            ui_prefs.router,
            logs.router,
            viewer.router,
            events.router,
            agent.router,
            weather.router,
        ]
    )
    return routers
