# Schema baseline (stamp 2)

Authority: domain fragments in `server/db/schema_domains/`, aggregated only by `server/db/schema.py`. Live inspection: `server/db/schema_inspect.py`. DDL fingerprint derivation: `server/db/schema_fingerprint.py`. Bootstrap, additive walk, and rejection policy: `server/db/schema_bootstrap.py` + runner `server/db/schema_migrate.py` + production steps `server/db/schema_steps.py`. Table inventory, calendar semantics, `system_config` policy, and product-shape notes live in [`ARCHITECTURE.md` Database](ARCHITECTURE.md#database).

**Stamp 1 is the schema floor** (`SCHEMA_FLOOR` = 1). **Stamp 2 is current** (`CURRENT_SCHEMA_VERSION` = 2, `SCHEMA_SEMVER` = `1.1.0`) and adds `schema_meta`. There is no lineage from retired pre-cut stamps (former 3–45 / `0.1.0-beta.*`). Startup creates the authoritative DDL only for an empty database, stamps an exact-current unstamped structure, and accepts an exact stamp-2 fingerprint. Existing stamp-1 files backup once and walk the production `SCHEMA_MIGRATIONS` step `1→2`. Pre-cut stamp-2 files that do not match the new fingerprint (for example missing `schema_meta`) still reject — they are not treated as already migrated. Retired numbers **3–45** are **future stamps** while CURRENT=2 and hard-reject with “update the application” (reset is a last resort). Corrupt / lookalike fingerprints hard-reject with `python scripts/reset_local_databases.py --apply`. Startup never silently deletes or rebuilds a database. Public identity is returned by `GET /api/v1/health` as `schemaVersion` and `schemaSemver`; `PRAGMA user_version` remains the integer stamp.

**Decoupled from product SemVer:** integer stamp + `SCHEMA_SEMVER` identify the **database contract**. Product releases are governed by **git tags** (`v*`／GitHub Release). They do **not** need to match each other, and CI must not treat root `VERSION` as a gate that forces tag equality or bot commits back to `main`.

## Version support

| Stamped `user_version` | Support |
|------------------------|---------|
| **2** (current, exact fingerprint) | Full runtime (`schemaSemver` = `1.1.0`) |
| **1** (floor, missing `schema_meta`) | Backup once, then additive `1→2` (`CREATE TABLE schema_meta` + seed `id=1` / `schema_semver`) |
| **0** (empty / exact-current unstamped) | Create or stamp current DDL (no fake-chain replay) |
| **FLOOR ≤ v < CURRENT** | Backup once, then additive step walk; validate the **current** fingerprint |
| **v > CURRENT** (including retired stamps 3–45 while CURRENT=2) | Hard reject — update the application; reset is a last resort; no automatic deletion |

## Floor invariant

Production `SCHEMA_MIGRATIONS` is `(target=2,)`. There is no empty registry, wipe-only current baseline, `_data_migrations` ledger, schema-upgrade route/UI, or `down()`. `test_schema_floor.py` hard-rejects retired stamps 27/45 and lookalike stamp-2 files missing `schema_meta`. `test_schema_migrate.py` proves the live `1→2` walk plus an injected test-only chain (3→10).

Do not revive retired stamps 3–45 as a migration chain. The next real DDL change appends stamp **3**.

## Schema v2 explicit reset

There is no automatic deletion. Future stamps are not converted. Stamp-1 files upgrade in place after a sidecar backup. Before resetting a **corrupt** or **future** database, stop Electron, `npm run dev`, and any standalone server so SQLite WAL state is closed. If data must be retained for manual recovery, copy the database outside every Intelligence Monitor data directory first. Additive migration of `FLOOR ≤ v < CURRENT` makes its own `*.pre-stamp-{target}.{yyyymmddhhmmss}.db` copy beside the live file.

Windows packaged-host example:

```powershell
$source = Join-Path $env:APPDATA "Intelligence Monitor"
$backup = Join-Path ([Environment]::GetFolderPath("Desktop")) ("IntelligenceMonitor-pre-v2-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
Copy-Item $source $backup -Recurse
```

For an overridden deployment, back up `INTELLIGENCE_MONITOR_DATA_DIR` (and any separate `INTELLIGENCE_MONITOR_DB`／`INTELLIGENCE_MONITOR_SESSIONS_DIR`) instead. Verify the external copy contains `intelligence_monitor.db` and any required `sessions`／configuration files.

Reset is always two explicit steps from the repository root:

```powershell
uv run python scripts/reset_local_databases.py          # dry-run: inspect every target
uv run python scripts/reset_local_databases.py --apply  # destructive only after review
```

The helper deletes only known SQLite database files and their `-wal`／`-shm` sidecars. It deliberately leaves backups, Telegram sessions, `secret.key`, `connection.json`, directories, and volumes untouched. Restart creates a fresh v2 database (schema_meta is seeded by DDL; no demo-data auto-seed). Restoring an old stamped database does not upgrade a **future** stamp—it restores the original unsupported state. Restoring a stamp-1 file starts the backup-then-walk to 2.

## Schema support matrix

| Opened database | Startup behavior | Mutation |
|-----------------|------------------|---------|
| Empty, version 0 | Create current DDL (including seeded `schema_meta`), validate its full fingerprint, then stamp 2 | Schema creation and v2 stamp |
| Unstamped current, version 0 | Require the exact v2 fingerprint and stamp 2 | Stamp only |
| Current, version 2 | Validate the exact v2 fingerprint on every startup | None |
| Stamp 1 (floor) | Copy db + WAL/SHM sidecars, apply `target=2`, then validate the current fingerprint | Additive `schema_meta` (same seeded row as fresh DDL) + stamp 2; one backup |
| FLOOR ≤ v < CURRENT | Copy db + WAL/SHM sidecars, walk each `MigrationStep`, then validate the current fingerprint | Additive DDL + stamp; one backup for the whole upgrade |
| Future version (`v > CURRENT`, including retired 3–45 while CURRENT=2) | Hard-reject: update the application | None |
| Incomplete/lookalike version 0 or current (including stamp-2 missing `schema_meta`) | Reject with table/column/index/foreign-key mismatch categories; backup then reset | None |

Single entry: `Database.ensure_schema` → `ensure_supported_schema`. Explicit rebuild is `Database.rebuild_current_schema` (user reset only). Business code continues to touch only `Database`.
