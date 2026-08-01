"""Compatibility exports for the authoritative schema declaration."""

from server.db.schema_ddl import DDL
from server.db.schema_fingerprint import (
    REQUIRED_COLUMNS,
    REQUIRED_FOREIGN_KEYS,
    REQUIRED_INDEXES,
    REQUIRED_TABLES,
)

__all__ = [
    "DDL",
    "REQUIRED_COLUMNS",
    "REQUIRED_FOREIGN_KEYS",
    "REQUIRED_INDEXES",
    "REQUIRED_TABLES",
]
