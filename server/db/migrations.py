"""Compatibility shim — use :mod:`server.db.schema_bootstrap`.

Stamp-5 wipe-only bootstrap lives in ``schema_bootstrap.py``. This module
re-exports the same public API so older ``from server.db.migrations import …``
imports keep working during the rename window.
"""

from __future__ import annotations

from server.db.schema_bootstrap import *  # noqa: F403
from server.db.schema_bootstrap import __all__ as __all__  # noqa: F401
