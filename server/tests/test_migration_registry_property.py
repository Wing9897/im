"""Property coverage for the ordered schema migration registry."""

from __future__ import annotations

from dataclasses import dataclass

import aiosqlite
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

import server.db.migrations as migrations
from server.db.migrations import MigrationStep, validate_migration_registry

_TRACE_MARKER = "Feature: codebase-simplification-round-2, Property 3"


@dataclass(frozen=True, slots=True)
class _RegistryCase:
    kind: str
    edges: tuple[tuple[int, int], ...]
    current_version: int
    raising_index: int | None = None


@st.composite
def _registry_cases(draw: st.DrawFn) -> _RegistryCase:
    kind = draw(
        st.sampled_from(
            (
                "contiguous",
                "gapped",
                "duplicate-source",
                "reverse",
                "non-one-step",
                "unordered",
                "over-current",
                "short-of-current",
                "raising",
            )
        )
    )
    start = draw(st.integers(min_value=0, max_value=5))

    if kind == "contiguous":
        length = draw(st.integers(min_value=0, max_value=5))
        edges = tuple((version, version + 1) for version in range(start, start + length))
        end = start + length
        # Non-empty registries must end exactly at current_version.
        current = draw(st.integers(min_value=0, max_value=8)) if length == 0 else end
        return _RegistryCase(kind, edges, current)
    if kind == "gapped":
        return _RegistryCase(kind, ((start, start + 1), (start + 2, start + 3)), start + 3)
    if kind == "duplicate-source":
        return _RegistryCase(kind, ((start, start + 1), (start, start + 1)), start + 1)
    if kind == "reverse":
        return _RegistryCase(kind, ((start + 1, start),), start + 1)
    if kind == "non-one-step":
        return _RegistryCase(kind, ((start, start + 2),), start + 2)
    if kind == "unordered":
        edges = ((start + 1, start + 2), (start, start + 1))
        return _RegistryCase(kind, edges, start + 2)
    if kind == "over-current":
        return _RegistryCase(kind, ((start, start + 1),), start)
    if kind == "short-of-current":
        return _RegistryCase(kind, ((start, start + 1),), start + 2)

    length = draw(st.integers(min_value=1, max_value=5))
    edges = tuple((version, version + 1) for version in range(start, start + length))
    raising_index = draw(st.integers(min_value=0, max_value=length - 1))
    return _RegistryCase(kind, edges, start + length, raising_index)


def _is_valid_registry(case: _RegistryCase) -> bool:
    """Independent structural oracle for registry acceptance."""
    sources = [source for source, _ in case.edges]
    if len(sources) != len(set(sources)) or sources != sorted(sources):
        return False
    for index, (source, target) in enumerate(case.edges):
        if source < 0 or target != source + 1 or target > case.current_version:
            return False
        if index and source != case.edges[index - 1][1]:
            return False
    if case.edges and case.edges[-1][1] != case.current_version:
        return False
    return True


async def _version(conn: aiosqlite.Connection) -> int:
    cursor = await conn.execute("PRAGMA user_version")
    try:
        row = await cursor.fetchone()
        assert row is not None
        return int(row[0])
    finally:
        await cursor.close()


class _ExpectedStepFailure(RuntimeError):
    pass


async def _exercise_supported_chain(case: _RegistryCase) -> None:
    """Exercise accepted complete chains against real SQLite transactions."""
    observations: list[tuple[str, int, int]] = []

    def make_apply(index: int, source: int, target: int):
        async def apply(conn: aiosqlite.Connection) -> None:
            observations.append(("start", source, await _version(conn)))
            await conn.execute("INSERT INTO migration_events VALUES (?, ?)", (source, target))
            if index == case.raising_index:
                raise _ExpectedStepFailure(f"step {source}->{target} failed")
            observations.append(("complete", source, await _version(conn)))

        return apply

    runtime_steps = tuple(
        MigrationStep(source, target, make_apply(index, source, target))
        for index, (source, target) in enumerate(case.edges)
    )
    runtime_registry = validate_migration_registry(runtime_steps, current_version=case.current_version)
    conn = await aiosqlite.connect(":memory:")
    original_current = migrations.CURRENT_SCHEMA_VERSION
    original_registry = migrations.SCHEMA_MIGRATIONS
    original_structure_check = migrations._require_current_structure
    try:
        await conn.execute("CREATE TEMP TABLE migration_events (source_version INTEGER, target_version INTEGER)")
        await conn.execute(f"PRAGMA user_version={case.edges[0][0]}")
        await conn.commit()
        migrations.CURRENT_SCHEMA_VERSION = case.current_version
        migrations.SCHEMA_MIGRATIONS = runtime_registry
        migrations._require_current_structure = lambda _fingerprint: None

        if case.raising_index is None:
            await migrations._apply_migration_chain(conn, case.edges[0][0])
        else:
            with pytest.raises(_ExpectedStepFailure):
                await migrations._apply_migration_chain(conn, case.edges[0][0])

        cursor = await conn.execute("SELECT source_version, target_version FROM migration_events ORDER BY rowid")
        try:
            committed_edges = tuple(tuple(row) for row in await cursor.fetchall())
        finally:
            await cursor.close()

        completed_count = len(case.edges) if case.raising_index is None else case.raising_index
        assert committed_edges == case.edges[:completed_count]
        expected_version = case.edges[completed_count][0] if completed_count < len(case.edges) else case.current_version
        assert await _version(conn) == expected_version

        attempted_count = completed_count + (case.raising_index is not None)
        started_sources = [source for event, source, _ in observations if event == "start"]
        expected_sources = [source for source, _ in case.edges[:attempted_count]]
        assert started_sources == expected_sources == sorted(started_sources)
        for event, source, observed_version in observations:
            assert observed_version == source, (event, source, observed_version)
    finally:
        migrations.CURRENT_SCHEMA_VERSION = original_current
        migrations.SCHEMA_MIGRATIONS = original_registry
        migrations._require_current_structure = original_structure_check
        await conn.close()


# Feature: codebase-simplification-round-2, Property 3
@pytest.mark.traceability(_TRACE_MARKER)
@settings(max_examples=150, deadline=None)
@given(case=_registry_cases())
async def test_migration_registry_ordering_is_total_for_supported_chains(
    case: _RegistryCase,
) -> None:
    """Feature: codebase-simplification-round-2, Property 3.

    **Validates: Requirements 2.7**
    """

    async def no_op(_conn: aiosqlite.Connection) -> None:
        return None

    steps = tuple(MigrationStep(source, target, no_op) for source, target in case.edges)
    expected_acceptance = _is_valid_registry(case)

    try:
        accepted = validate_migration_registry(steps, current_version=case.current_version)
    except ValueError:
        assert not expected_acceptance
        return

    assert expected_acceptance
    assert accepted == steps

    is_complete_chain = bool(case.edges) and case.edges[-1][1] == case.current_version
    if is_complete_chain:
        await _exercise_supported_chain(case)
