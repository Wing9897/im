"""Database layer: aiosqlite connection wrapper + wipe-only stamp-45 DDL.

Authoritative schema: domain fragments under ``schema_domains/`` aggregated by
``schema.py`` (``PRAGMA user_version`` = current stamp).
Bootstrap／reject policy lives in ``schema_bootstrap.py`` — create empty DBs from
DDL, stamp exact-current unstamped DBs, hard-reject everything else. There is
**no** migration registry or in-place upgrade path. Reset does **not** auto-seed.
"""

from server.db.database import Database
from server.db.schema_inspect import SchemaEvolutionError

__all__ = ["Database", "SchemaEvolutionError"]
