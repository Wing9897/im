# Schema baseline (stamp 6)

Authority: domain fragments in `server/db/schema_domains/`, aggregated only by `server/db/schema.py`. Live inspection: `server/db/schema_inspect.py`. DDL fingerprint derivation: `server/db/schema_fingerprint.py`. Bootstrap, additive walk, and rejection policy: `server/db/schema_bootstrap.py` + runner `server/db/schema_migrate.py` + production steps `server/db/schema_steps.py`. Table inventory, calendar semantics, `system_config` policy, and product-shape notes live in [`ARCHITECTURE.md` Database](ARCHITECTURE.md#database).

**Stamp 6 is both the schema floor and current** (`SCHEMA_FLOOR` = 6, `CURRENT_SCHEMA_VERSION` = 6, `SCHEMA_SEMVER` = `1.5.0`). Fresh databases create current DDL only (including `schema_meta`, `worksets.description` / `cover_data_url`, and `calendar_share_publish` with `last_cover` plus household auto-sync cache columns). Stamp 6 stores calendar-share publish state in `calendar_share_publish` (unpublished worksets have no row) and does not keep `system_config.calendar_share_worksets` JSON or leftover `calendar_share_subscriptions`. Household auto-sync lives in `system_config` (`calendar_share_auto_sync` / `calendar_share_auto_sync_interval_seconds`); the matching columns on `calendar_share_publish` are a mirrored cache. There is no lineage from retired pre-cut stamps (former 27/45 / `0.1.0-beta.*`). Startup creates the authoritative DDL only for an empty database, stamps an exact-current unstamped structure, and accepts an exact stamp-6 fingerprint.

**Stamp 1–5 files do not upgrade.** Copy the database out of the data directory first, then run `python scripts/reset_local_databases.py --apply`. There is no 5→6 additive walk: published stamp-5 files lack the auto-sync columns and hard-reject. Calendar-share JSON that lived only on stamps 1–4 is discarded. Retired numbers **27** and **45** are **future stamps** and hard-reject with “update the application” (reset is a last resort). Corrupt / lookalike fingerprints hard-reject with the same reset command. Startup never silently deletes or rebuilds a database. Public identity is returned by `GET /api/v1/health` as `schemaVersion` and `schemaSemver`; `PRAGMA user_version` remains the integer stamp.

**Decoupled from product SemVer:** integer stamp + `SCHEMA_SEMVER` identify the **database contract**. Product releases are governed by **git tags** (`v*`／GitHub Release). They do **not** need to match each other, and CI must not treat root `VERSION` as a gate that forces tag equality or bot commits back to `main`.

## Version support

| Stamped `user_version` | Support |
|------------------------|---------|
| **6** (floor and current, exact fingerprint) | Full runtime (`schemaSemver` = `1.5.0`) |
| **5** / **4** / **3** / **2** / **1** | Hard reject — backup, then reset (no additive walk) |
| **0** (empty / exact-current unstamped) | Create or stamp current DDL (no fake-chain replay) |
| **FLOOR ≤ v < CURRENT** | Backup once, then additive step walk; validate the **current** fingerprint (registry empty while floor equals current) |
| **v > CURRENT** (including retired stamps 27/45) | Hard reject — update the application; reset is a last resort; no automatic deletion |

## Floor invariant

Production `SCHEMA_MIGRATIONS` is empty (`SCHEMA_FLOOR` = `CURRENT` = 6). There is no JSON `calendar_share_worksets` migration, `_data_migrations` ledger, schema-upgrade route/UI, or `down()`. `test_schema_floor.py` hard-rejects stamp 1–5, retired stamps 27/45, and lookalike current-stamp files missing `schema_meta`. `test_schema_migrate.py` proves the injected test-only chain (3→10) plus leftover listing-string remap on the current stamp.

Do not revive retired stamps 27/45 as a migration chain. **This stamp-6 Release does not upgrade old databases** (no 5→6 walk). The next real DDL change appends stamp **7**: leave `SCHEMA_FLOOR` at 6, set `CURRENT` to 7, and register a non-empty `SCHEMA_MIGRATIONS` additive step. Later upgrades continue as stamp 8+ on that same walk, not as another wipe.

## Schema v6 explicit reset

There is no automatic deletion. Future stamps are not converted. Stamp-1 / stamp-2 / stamp-3 / stamp-4 / stamp-5 files are not upgraded — back them up, then reset. Before resetting a **corrupt**, **below-floor**, or **future** database, stop Electron, `npm run dev`, and any standalone server so SQLite WAL state is closed. If data must be retained for manual recovery, copy the database outside every Intelligence Monitor data directory first.

Windows packaged-host example:

```powershell
$source = Join-Path $env:APPDATA "Intelligence Monitor"
$backup = Join-Path ([Environment]::GetFolderPath("Desktop")) ("IntelligenceMonitor-db-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
Copy-Item $source $backup -Recurse
```

For an overridden deployment, back up `INTELLIGENCE_MONITOR_DATA_DIR` (and any separate `INTELLIGENCE_MONITOR_DB`／`INTELLIGENCE_MONITOR_SESSIONS_DIR`) instead. Verify the external copy contains `intelligence_monitor.db` and any required `sessions`／configuration files.

Reset is always two explicit steps from the repository root:

```powershell
uv run python scripts/reset_local_databases.py          # dry-run: inspect every target
uv run python scripts/reset_local_databases.py --apply  # destructive only after review
```

The helper deletes only known SQLite database files and their `-wal`／`-shm` sidecars. It deliberately leaves backups, Telegram sessions, `secret.key`, `connection.json`, directories, and volumes untouched. Restart creates a fresh v6 database (schema_meta is seeded by DDL; no demo-data auto-seed). Restoring an old stamped database does not upgrade a **future** stamp—it restores the original unsupported state. Restoring a stamp-1 / stamp-2 / stamp-3 / stamp-4 / stamp-5 file still rejects until you reset.

## Schema support matrix

| Opened database | Startup behavior | Mutation |
|-----------------|------------------|---------|
| Empty, version 0 | Create current DDL (including seeded `schema_meta`), validate its full fingerprint, then stamp 6 | Schema creation and v6 stamp |
| Unstamped current, version 0 | Require the exact v6 fingerprint and stamp 6 | Stamp only |
| Current, version 6 | Validate the exact v6 fingerprint on every startup; one-shot remap leftover listing aliases `off`/`details`/`busy` if any rows remain | None (remap is a no-op when already canonical) |
| Stamp 5 / 4 / 3 / 2 / 1 | Hard-reject: backup then reset | None |
| FLOOR ≤ v < CURRENT | Copy db + WAL/SHM sidecars, walk each `MigrationStep`, then validate the current fingerprint | Additive DDL + stamp; one backup for the whole upgrade (no production steps while floor equals current) |
| Future version (`v > CURRENT`, including retired 27/45) | Hard-reject: update the application | None |
| Incomplete/lookalike version 0 or current (including stamp-2 missing `schema_meta`) | Reject with table/column/index/foreign-key mismatch categories; backup then reset | None |

Single entry: `Database.ensure_schema` → `ensure_supported_schema`. Explicit rebuild is `Database.rebuild_current_schema` (user reset only). Business code continues to touch only `Database`.
