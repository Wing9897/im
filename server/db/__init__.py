"""Database layer: aiosqlite connection wrapper + current-stamp DDL.

Authoritative schema: domain fragments under ``schema_domains/`` aggregated by
``schema.py`` (``PRAGMA user_version`` = current stamp).
Bootstrap／migrate／reject policy lives in ``schema_bootstrap.py`` — create empty
DBs from DDL, walk ``SCHEMA_FLOOR <= v < CURRENT`` via ``schema_migrate.py``,
hard-reject future or corrupt stamps. Reset does **not** auto-seed demo data.
"""

from server.db.database import Database
from server.db.schema_inspect import SchemaEvolutionError

__all__ = ["Database", "SchemaEvolutionError"]
