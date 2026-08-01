"""Shared helpers for task route modules."""

from __future__ import annotations

from fastapi import Request

from server.api.deps import get_scheduler, publish_resource_modified


def notify(request: Request, task_id: str, action: str) -> None:
    publish_resource_modified(request, "task", task_id, action)


async def register_task(request: Request, task_id: str) -> None:
    scheduler = get_scheduler(request)
    if scheduler is not None:
        await scheduler.register_task(task_id)


async def unregister_task(request: Request, task_id: str) -> None:
    scheduler = get_scheduler(request)
    if scheduler is not None:
        await scheduler.unregister_task(task_id)
