"""Tasks routes: catalog / schedule / project / crud (thin modules + services).

Fixed-path routes (templates / activity-spans) register before ``/{task_id}``
routes so they are never captured as ids. The chat-assistant endpoint lives in
``server/api/routes/task_assistant.py``.

Side-effect import order below is intentional (isort disabled for this block).
"""

from __future__ import annotations

from server.api.routes.task_helpers import TaskConfigBody
from server.api.routes.tasks._router import router

# isort: off
from server.api.routes.tasks import catalog as _catalog  # noqa: F401
from server.api.routes.tasks import schedule as _schedule  # noqa: F401
from server.api.routes.tasks import project as _project  # noqa: F401
from server.api.routes.tasks import crud as _crud  # noqa: F401
# isort: on

__all__ = ["TaskConfigBody", "router"]
