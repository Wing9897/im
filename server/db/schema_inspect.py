"""SQLite schema fingerprint types and live introspection.

Version classification / stamping / MigrationStep chains live in
:mod:`server.db.migrations`. DDL-derived expected signatures come from
:mod:`server.db.schema`.
"""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Iterable, Mapping, TypeVar

import aiosqlite

from server.db.schema import (
    REQUIRED_COLUMNS,
    REQUIRED_FOREIGN_KEYS,
    REQUIRED_INDEXES,
    REQUIRED_TABLES,
)
from server.db.schema_fingerprint import _quoted_identifier

CURRENT_SCHEMA_VERSION = 4
#: Public SemVer for this schema baseline (same shape as product VERSION).
#: PRAGMA user_version stays the integer stamp above — never a SemVer string.
SCHEMA_SEMVER = "0.1.0-beta.6"


class SchemaEvolutionError(RuntimeError):
    """Raised when a database fingerprint or schema version is unsupported."""


@dataclass(frozen=True, order=True, slots=True)
class ColumnSignature:
    """Exact structural identity for one required table column."""

    name: str
    declared_type: str
    not_null: bool
    default_present: bool
    default_expression: str | None
    primary_key_ordinal: int


@dataclass(frozen=True, order=True, slots=True)
class IndexKeySignature:
    """One key in an explicit index's semantic sequence."""

    column_name: str
    descending: bool


@dataclass(frozen=True, order=True, slots=True)
class IndexSignature:
    """Exact structural identity for one required explicit index."""

    name: str
    unique: bool
    partial_present: bool
    predicate: str | None
    keys: tuple[IndexKeySignature, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "keys", tuple(self.keys))


@dataclass(frozen=True, order=True, slots=True)
class ForeignKeyGroupSignature:
    """One foreign-key constraint with its ordered source/target members."""

    target_table: str
    on_update: str
    on_delete: str
    members: tuple[tuple[str, str], ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "members", tuple(tuple(member) for member in self.members))


_T = TypeVar("_T")


def _freeze_mapping(values: Mapping[str, Iterable[_T]]) -> Mapping[str, frozenset[_T]]:
    """Copy a mapping into a deterministic, transitively immutable form."""
    return MappingProxyType({key: frozenset(values[key]) for key in sorted(values)})


def _freeze_foreign_key_mapping(
    values: Mapping[str, Iterable[ForeignKeyGroupSignature]],
) -> Mapping[str, tuple[ForeignKeyGroupSignature, ...]]:
    """Canonicalize FK groups without discarding duplicate constraints."""
    return MappingProxyType({key: tuple(sorted(values[key])) for key in sorted(values)})


@dataclass(frozen=True, slots=True)
class SchemaFingerprint:
    """Immutable exact, outer-order-independent application schema snapshot."""

    version: int
    tables: frozenset[str]
    columns: Mapping[str, frozenset[ColumnSignature]]
    indexes: Mapping[str, frozenset[IndexSignature]]
    foreign_keys: Mapping[str, tuple[ForeignKeyGroupSignature, ...]]

    def __post_init__(self) -> None:
        object.__setattr__(self, "tables", frozenset(self.tables))
        object.__setattr__(self, "columns", _freeze_mapping(self.columns))
        object.__setattr__(self, "indexes", _freeze_mapping(self.indexes))
        object.__setattr__(self, "foreign_keys", _freeze_foreign_key_mapping(self.foreign_keys))

    def __hash__(self) -> int:
        """Hash the normalized content rather than unhashable mapping proxies."""
        return hash(
            (
                self.version,
                self.tables,
                tuple((key, self.columns[key]) for key in sorted(self.columns)),
                tuple((key, self.indexes[key]) for key in sorted(self.indexes)),
                tuple((key, self.foreign_keys[key]) for key in sorted(self.foreign_keys)),
            )
        )


CURRENT_SCHEMA_FINGERPRINT = SchemaFingerprint(
    version=CURRENT_SCHEMA_VERSION,
    tables=REQUIRED_TABLES,
    columns={
        table: frozenset(ColumnSignature(*signature) for signature in signatures)
        for table, signatures in REQUIRED_COLUMNS.items()
    },
    indexes={
        table: frozenset(
            IndexSignature(
                name=name,
                unique=unique,
                partial_present=partial_present,
                predicate=predicate,
                keys=tuple(IndexKeySignature(*key) for key in keys),
            )
            for name, unique, partial_present, predicate, keys in signatures
        )
        for table, signatures in REQUIRED_INDEXES.items()
    },
    foreign_keys={
        table: tuple(
            ForeignKeyGroupSignature(
                target_table=target_table,
                on_update=on_update,
                on_delete=on_delete,
                members=members,
            )
            for target_table, on_update, on_delete, members in signatures
        )
        for table, signatures in REQUIRED_FOREIGN_KEYS.items()
    },
)


async def _fetchall(conn: aiosqlite.Connection, sql: str) -> list[Any]:
    cursor = await conn.execute(sql)
    try:
        return list(await cursor.fetchall())
    finally:
        await cursor.close()


async def inspect_schema(conn: aiosqlite.Connection) -> SchemaFingerprint:
    """Inspect exact user-table metadata and normalize only discovery order.

    SQLite-owned tables and indexes (including primary-key/unique-constraint
    auto-indexes) are deliberately absent from the fingerprint. The private
    ``_data_migrations`` ledger is also excluded so content migration tracking
    remains separate from schema-version transitions.
    """
    version_rows = await _fetchall(conn, "PRAGMA user_version")
    version = int(version_rows[0][0]) if version_rows else 0
    table_rows = await _fetchall(
        conn,
        "SELECT name FROM sqlite_master "
        "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' "
        "AND name != '_data_migrations'",
    )
    tables = frozenset(str(row[0]) for row in table_rows)

    columns: dict[str, frozenset[ColumnSignature]] = {}
    indexes: dict[str, frozenset[IndexSignature]] = {}
    foreign_keys: dict[str, tuple[ForeignKeyGroupSignature, ...]] = {}
    for table in tables:
        quoted_table = _quoted_identifier(table)
        column_rows = await _fetchall(conn, f"PRAGMA table_info({quoted_table})")
        columns[table] = frozenset(
            ColumnSignature(
                name=str(row[1]),
                declared_type=str(row[2]),
                not_null=bool(row[3]),
                default_present=row[4] is not None,
                default_expression=None if row[4] is None else str(row[4]),
                primary_key_ordinal=int(row[5]),
            )
            for row in column_rows
        )

        index_rows = await _fetchall(conn, f"PRAGMA index_list({quoted_table})")
        table_indexes: set[IndexSignature] = set()
        for row in index_rows:
            index_name = str(row[1])
            if index_name.lower().startswith("sqlite_") or str(row[3]).lower() != "c":
                continue

            quoted_index = _quoted_identifier(index_name)
            key_rows = sorted(
                (
                    key_row
                    for key_row in await _fetchall(conn, f"PRAGMA index_xinfo({quoted_index})")
                    if bool(key_row[5])
                ),
                key=lambda key_row: int(key_row[0]),
            )
            partial_present = bool(row[4])
            predicate: str | None = None
            if partial_present:
                cursor = await conn.execute(
                    "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?",
                    (index_name,),
                )
                try:
                    sql_row = await cursor.fetchone()
                finally:
                    await cursor.close()
                if sql_row is None or sql_row[0] is None:
                    raise SchemaEvolutionError(f"Partial index {index_name!r} has no SQL definition")
                index_sql = str(sql_row[0]).rstrip().removesuffix(";").rstrip()
                where_position = index_sql.upper().rfind(" WHERE ")
                if where_position < 0:
                    raise SchemaEvolutionError(f"Partial index {index_name!r} has no WHERE predicate")
                predicate = index_sql[where_position + len(" WHERE ") :].strip()

            table_indexes.add(
                IndexSignature(
                    name=index_name,
                    unique=bool(row[2]),
                    partial_present=partial_present,
                    predicate=predicate,
                    keys=tuple(
                        IndexKeySignature(
                            column_name=str(key_row[2]),
                            descending=bool(key_row[3]),
                        )
                        for key_row in key_rows
                    ),
                )
            )
        indexes[table] = frozenset(table_indexes)

        foreign_key_rows = await _fetchall(conn, f"PRAGMA foreign_key_list({quoted_table})")
        rows_by_group: dict[int, list[Any]] = {}
        for row in foreign_key_rows:
            rows_by_group.setdefault(int(row[0]), []).append(row)
        foreign_keys[table] = tuple(
            ForeignKeyGroupSignature(
                target_table=str(ordered_rows[0][2]),
                on_update=str(ordered_rows[0][5]).upper(),
                on_delete=str(ordered_rows[0][6]).upper(),
                members=tuple((str(row[3]), str(row[4])) for row in ordered_rows),
            )
            for group_rows in rows_by_group.values()
            for ordered_rows in [sorted(group_rows, key=lambda row: int(row[1]))]
        )

    return SchemaFingerprint(
        version=version,
        tables=tables,
        columns=columns,
        indexes=indexes,
        foreign_keys=foreign_keys,
    )


def _fingerprint_mismatch_categories(fingerprint: SchemaFingerprint) -> tuple[str, ...]:
    """Return stable structural mismatch categories, ignoring only the stamp."""
    expected = CURRENT_SCHEMA_FINGERPRINT
    categories: list[str] = []
    if fingerprint.tables != expected.tables:
        categories.append("tables")
    if fingerprint.columns != expected.columns:
        categories.append("columns")
    if fingerprint.indexes != expected.indexes:
        categories.append("indexes")
    if fingerprint.foreign_keys != expected.foreign_keys:
        categories.append("foreign keys")
    return tuple(categories)


def _require_current_structure(fingerprint: SchemaFingerprint) -> None:
    categories = _fingerprint_mismatch_categories(fingerprint)
    if categories:
        detail = ", ".join(categories)
        raise SchemaEvolutionError(f"Database schema version {fingerprint.version} fingerprint mismatch: {detail}")
