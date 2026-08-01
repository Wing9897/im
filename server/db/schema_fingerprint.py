"""Structural fingerprint derived from the authoritative schema DDL.

Instead of maintaining a hand-written manifest beside the DDL, the required
structure is derived once at import time by executing ``schema_ddl.DDL`` in an
in-memory ``sqlite3`` database and introspecting it. The introspection mirrors
    ``server.db.schema_inspect.inspect_schema`` (same PRAGMA sources and normalization)
so "DDL-derived fingerprint" and "live-connection fingerprint" are directly
comparable.
"""

from __future__ import annotations

import sqlite3

from server.db.schema_ddl import DDL

# Spec tuple shapes consumed by ``server.db.schema_inspect`` signature dataclasses.
ColumnSpec = tuple[str, str, bool, bool, str | None, int]
IndexKeySpec = tuple[str, bool]
IndexSpec = tuple[str, bool, bool, str | None, tuple[IndexKeySpec, ...]]
ForeignKeyMemberSpec = tuple[str, str]
ForeignKeyGroupSpec = tuple[str, str, str, tuple[ForeignKeyMemberSpec, ...]]


def _quoted_identifier(value: str) -> str:
    """Quote an introspected SQLite identifier for a PRAGMA statement.

    Shared with ``server.db.migrations.inspect_schema`` (same escaping rules).
    """
    return '"' + value.replace('"', '""') + '"'


def _table_columns(conn: sqlite3.Connection, table: str) -> frozenset[ColumnSpec]:
    rows = conn.execute(f"PRAGMA table_info({_quoted_identifier(table)})").fetchall()
    return frozenset(
        (
            str(row[1]),
            str(row[2]),
            bool(row[3]),
            row[4] is not None,
            None if row[4] is None else str(row[4]),
            int(row[5]),
        )
        for row in rows
    )


def _index_predicate(conn: sqlite3.Connection, index_name: str) -> str:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?",
        (index_name,),
    ).fetchone()
    if row is None or row[0] is None:
        raise ValueError(f"Partial index {index_name!r} has no SQL definition")
    index_sql = str(row[0]).rstrip().removesuffix(";").rstrip()
    where_position = index_sql.upper().rfind(" WHERE ")
    if where_position < 0:
        raise ValueError(f"Partial index {index_name!r} has no WHERE predicate")
    return index_sql[where_position + len(" WHERE ") :].strip()


def _table_indexes(conn: sqlite3.Connection, table: str) -> frozenset[IndexSpec]:
    specs: set[IndexSpec] = set()
    for row in conn.execute(f"PRAGMA index_list({_quoted_identifier(table)})").fetchall():
        index_name = str(row[1])
        # Only explicit CREATE INDEX statements; SQLite-owned auto-indexes
        # (primary key / UNIQUE constraints) are excluded from the fingerprint.
        if index_name.lower().startswith("sqlite_") or str(row[3]).lower() != "c":
            continue
        key_rows = sorted(
            (
                key_row
                for key_row in conn.execute(f"PRAGMA index_xinfo({_quoted_identifier(index_name)})").fetchall()
                if bool(key_row[5])
            ),
            key=lambda key_row: int(key_row[0]),
        )
        partial_present = bool(row[4])
        specs.add(
            (
                index_name,
                bool(row[2]),
                partial_present,
                _index_predicate(conn, index_name) if partial_present else None,
                tuple((str(key_row[2]), bool(key_row[3])) for key_row in key_rows),
            )
        )
    return frozenset(specs)


def _table_foreign_keys(conn: sqlite3.Connection, table: str) -> tuple[ForeignKeyGroupSpec, ...]:
    rows_by_group: dict[int, list[tuple]] = {}
    for row in conn.execute(f"PRAGMA foreign_key_list({_quoted_identifier(table)})").fetchall():
        rows_by_group.setdefault(int(row[0]), []).append(row)
    return tuple(
        (
            str(ordered_rows[0][2]),
            str(ordered_rows[0][5]).upper(),
            str(ordered_rows[0][6]).upper(),
            tuple((str(row[3]), str(row[4])) for row in ordered_rows),
        )
        for group_rows in rows_by_group.values()
        for ordered_rows in [sorted(group_rows, key=lambda row: int(row[1]))]
    )


def _derive_required_structure() -> tuple[
    frozenset[str],
    dict[str, frozenset[ColumnSpec]],
    dict[str, frozenset[IndexSpec]],
    dict[str, tuple[ForeignKeyGroupSpec, ...]],
]:
    conn = sqlite3.connect(":memory:")
    try:
        conn.executescript(DDL)
        table_rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
        tables = frozenset(str(row[0]) for row in table_rows)
        columns = {table: _table_columns(conn, table) for table in tables}
        indexes = {table: _table_indexes(conn, table) for table in tables}
        foreign_keys = {table: _table_foreign_keys(conn, table) for table in tables}
        return tables, columns, indexes, foreign_keys
    finally:
        conn.close()


REQUIRED_TABLES, REQUIRED_COLUMNS, REQUIRED_INDEXES, REQUIRED_FOREIGN_KEYS = _derive_required_structure()
