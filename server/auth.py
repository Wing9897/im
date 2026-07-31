"""Auth entrypoints — thin re-exports from :mod:`server.household_auth`.

Kept as ``server.auth`` so existing ``Depends(verify_auth)`` imports stay stable.
"""

from __future__ import annotations

from server.household_auth import (
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
