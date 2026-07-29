"""Executable drift guards for schema ownership and support documentation."""

from __future__ import annotations

import ast
from pathlib import Path

from server.db.migrations import CURRENT_SCHEMA_VERSION, SCHEMA_MIGRATIONS, migration_pending

_REPO_ROOT = Path(__file__).resolve().parents[2]
_ARCHITECTURE = "docs/ARCHITECTURE.md"


def _read(relative_path: str) -> str:
    return (_REPO_ROOT / relative_path).read_text(encoding="utf-8")


def _schema_matrix_rows() -> dict[str, str]:
    architecture = _read(_ARCHITECTURE)
    heading = "### Schema support matrix"
    assert architecture.count(heading) == 1, f"{_ARCHITECTURE}: expected one authoritative {heading!r}"
    section = architecture.split(heading, 1)[1].split("\n### ", 1)[0]
    rows: dict[str, str] = {}
    for line in section.splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) == 3 and cells[0] not in {"Opened database", "-----------------"}:
            rows[cells[0]] = " | ".join(cells[1:])
    return rows


def _imports(relative_path: str) -> set[str]:
    tree = ast.parse(_read(relative_path), filename=relative_path)
    imports: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module)
    return imports


def test_support_matrix_tracks_executable_current_schema_version() -> None:
    version = CURRENT_SCHEMA_VERSION
    registered_sources = sorted({step.source_version for step in SCHEMA_MIGRATIONS})
    expected = {
        "Empty, version 0": (
            f"Create v{version} DDL",
            "validate its full fingerprint",
            f"stamp v{version}",
        ),
        "Unstamped current, version 0": (
            f"exact v{version} fingerprint",
            "preserve all domain data",
            f"v{version} stamp only",
        ),
        f"Current, version {version}": (
            f"exact v{version} fingerprint",
            "every startup",
            "None",
        ),
        f"Incomplete/lookalike version 0 or {version}": (
            "Reject",
            "table/column/index/foreign-key",
            "None",
        ),
        "Unsupported or future version": ("Reject", "never downgraded", "None"),
        "Future evidenced migration": (
            "ordered, contiguous",
            "stamp only after successful work",
            f"ends at v{version}",
        ),
    }
    # Wipe-only band: stamped versions below the lowest registered source (or
    # below current when the registry is empty).
    wipe_ceiling = min(registered_sources) - 1 if registered_sources else version - 1
    if wipe_ceiling >= 1:
        expected[f"Prior, version 1–{wipe_ceiling}"] = (
            "Hard-reject",
            "ensure_schema",
            "None",
        )
    for source in registered_sources:
        expected[f"Prior, version {source}"] = (
            "Upgrade-gate",
            "MigrationStep",
            f"Stamp {version}",
        )

    rows = _schema_matrix_rows()
    drift = [
        f"{_ARCHITECTURE}: row {name!r} missing wording {fragment!r}"
        for name, fragments in expected.items()
        for fragment in fragments
        if name not in rows or fragment.casefold() not in rows[name].casefold()
    ]
    assert not drift, "Schema support-matrix drift:\n" + "\n".join(drift)

    # Registered priors must open the gate; the hard-reject band must not.
    assert all(migration_pending(source) for source in registered_sources)
    hard_reject_band = [v for v in range(0, version) if v not in registered_sources]
    assert not any(migration_pending(v) for v in hard_reject_band)


def test_architecture_remains_the_single_schema_policy_authority() -> None:
    references = {
        "server/main.py": "docs/ARCHITECTURE.md",
        "server/db/database.py": "docs/ARCHITECTURE.md",
        "server/db/migrations.py": "docs/ARCHITECTURE.md",
        "docs/KNOWN-SIMPLIFICATIONS.md": "ARCHITECTURE.md#schema-support-matrix",
    }
    missing = [
        f"{path}: missing reference to {reference}"
        for path, reference in references.items()
        if reference not in _read(path)
    ]
    stale_phrases = ("delete the database and restart", "fresh-only schema", "only fresh databases")
    conflicts = [
        f"{path}: conflicting claim {phrase!r}"
        for path in references
        for phrase in stale_phrases
        if phrase in _read(path).casefold()
    ]
    assert not missing + conflicts, "Schema documentation authority drift:\n" + "\n".join(missing + conflicts)


def test_explicit_reset_is_the_only_normal_destructive_schema_path() -> None:
    references: list[str] = []
    for path in (_REPO_ROOT / "server").rglob("*.py"):
        if "tests" in path.parts:
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if "_rebuild_file(" in line:
                references.append(f"{path.relative_to(_REPO_ROOT).as_posix()}: {line.strip()}")
    references.sort()
    assert references == [
        "server/api/routes/system.py: await db._rebuild_file()  # noqa: SLF001 — deliberate full reset",
        "server/db/database.py: async def _rebuild_file(self) -> None:",
    ], "Destructive schema path drift:\n" + "\n".join(references)


def test_content_migrations_stay_outside_schema_registry() -> None:
    schema_imports = _imports("server/db/migrations.py")
    data_imports = _imports("server/db/data_migrations.py")
    assert "server.db.data_migrations" not in schema_imports, (
        "server/db/migrations.py absorbed content migration ownership"
    )
    assert "server.db.migrations" not in data_imports, "server/db/data_migrations.py depends on the schema registry"


def test_lifecycle_ownership_and_collector_delegate_documentation_do_not_drift() -> None:
    architecture = _read(_ARCHITECTURE)
    required = (
        "### Managed-task lifecycle ownership",
        "server/main.py",
        "server/scheduler/manager.py",
        "CollectorManager",
        "CollectorRetryOrchestrator",
        "manager delegates",
    )
    missing = [term for term in required if term not in architecture]
    assert "manager mixins" not in architecture
    assert not missing, f"{_ARCHITECTURE}: missing lifecycle authority terms: {missing}"


def test_collector_retry_has_one_owner_and_direct_sqlite_busy_dependency() -> None:
    manager = _read("server/collector/manager.py")
    retry_owner = _read("server/collector/manager_retry.py")
    production_sources = {
        path.relative_to(_REPO_ROOT).as_posix(): path.read_text(encoding="utf-8")
        for path in (_REPO_ROOT / "server/collector").glob("*.py")
    }
    retry_mapping_owners = [path for path, source in production_sources.items() if "self._retry_tasks" in source]

    assert retry_mapping_owners == ["server/collector/manager_retry.py"]
    assert "_is_database_locked_error" not in manager + retry_owner
    assert "from server.db.sqlite_busy import is_sqlite_busy" in retry_owner
    assert "is_sqlite_busy(exc)" in retry_owner
    assert "server.collector.manager" not in _imports("server/collector/manager_retry.py")
    assert "server.collector.manager_retry" in _imports("server/collector/manager.py")
