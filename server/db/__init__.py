"""Database layer: aiosqlite connection wrapper + wipe-only stamp-8 DDL.

Authoritative schema: ``schema_ddl.py`` (**27** tables, ``PRAGMA user_version=8``).
Bootstrap／reject policy lives in ``schema_bootstrap.py`` — create empty DBs from
DDL, stamp exact-current unstamped DBs, hard-reject everything else. There is
**no** migration registry or in-place upgrade path.
"""

from server.db.database import Database

__all__ = ["Database"]
