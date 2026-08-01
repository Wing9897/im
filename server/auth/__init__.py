"""Household auth package: admin password → device session; API keys.

Public entrypoints used by FastAPI ``Depends`` and route modules:

- :func:`verify_auth` / :func:`verify_write_access`
- :func:`is_loopback` / :func:`presented_token`

Submodules: ``admin_auth``, ``device_auth``, ``access_keys``, ``household_auth``.
HTTP paths are unchanged (``/api/v1/setup/*``, ``/api/v1/access-keys``, …).
"""

from __future__ import annotations

from server.auth.household_auth import (
    is_loopback,
    presented_token,
    verify_auth,
    verify_write_access,
)

__all__ = [
    "is_loopback",
    "presented_token",
    "verify_auth",
    "verify_write_access",
]
