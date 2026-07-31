"""Database layer: aiosqlite connection wrapper + wipe-only stamp-5 DDL.

Authoritative schema: ``schema_ddl.py`` (**25** tables, ``PRAGMA user_version=5``).
Bootstrap／reject policy lives in ``migrations.py`` — create empty DBs from DDL,
stamp exact-current unstamped DBs, hard-reject everything else. There is **no**
migration registry or in-place upgrade path.
"""

from server.db.database import Database

__all__ = ["Database"]
