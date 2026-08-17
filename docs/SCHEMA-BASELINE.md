# Schema baseline (wipe-only)

Authority: domain fragments in `server/db/schema_domains/`, aggregated only by `server/db/schema.py`. Live inspection: `server/db/schema_inspect.py`. DDL fingerprint derivation: `server/db/schema_fingerprint.py`. Bootstrap and rejection policy: `server/db/schema_bootstrap.py`. Table inventory and calendar semantics stay in [`ARCHITECTURE.md` Database](ARCHITECTURE.md#database).

**Current stamp is 39** (`SCHEMA_SEMVER` = `0.1.0-beta.40`). Startup creates the authoritative DDL only for an empty database, stamps an exact-current unstamped structure, and accepts an exact stamp-39 fingerprint. Every other non-empty schema hard-rejects before collector/scheduler startup with `python scripts/reset_local_databases.py --apply` in the error. Startup never migrates, backs up, restores, or silently deletes a database. Public identity is returned by `GET /api/v1/health` as `schemaVersion` and `schemaSemver`; `PRAGMA user_version` remains the integer stamp.

**Decoupled from product SemVer:** integer stamp + `SCHEMA_SEMVER` identify the **database wipe-only contract**. Product releases are governed by **git tags** (`v*`／GitHub Release). They do **not** need to match each other, and CI must not treat root `VERSION` as a gate that forces tag equality or bot commits back to `main`.

## Version support

| Stamped `user_version` | Support |
|------------------------|---------|
| **39** (current, exact fingerprint) | Full runtime (`schemaSemver` = `0.1.0-beta.40`) |
| **38** and earlier (prior) | Hard-reject → reset |
| **0** (empty / exact-current unstamped) | Create or stamp current DDL |
| **Any other non-empty schema** | Hard reject — explicit DB reset (no in-place path or automatic deletion) |

## Wipe-floor invariant

There is no migration registry, `_data_migrations` ledger, schema-upgrade route/UI, backup marker, or post-migration validator in stamp 39. `test_schema_wipe_floor.py` guards this hard cut and the reset guidance.

**Stamp 39 is the wipe-only floor** (`SCHEMA_SEMVER` `0.1.0-beta.40`; prior stamps ≤38 hard-reject). Prior stamp history is absorbed into this floor — see [`CHANGELOG.md`](../CHANGELOG.md) / prior release notes; do not keep a per-stamp migration narrative here. A future in-place migration must be introduced deliberately as a new contract; no dormant fake migration chain remains.

## Schema v39 explicit reset

There is no automatic deletion or in-place conversion from an older stamp. Before resetting, stop Electron, `npm run dev`, and any standalone server so SQLite WAL state is closed. If data must be retained for manual recovery, copy the database outside every Intelligence Monitor data directory first.

Windows packaged-host example:

```powershell
$source = Join-Path $env:APPDATA "Intelligence Monitor"
$backup = Join-Path ([Environment]::GetFolderPath("Desktop")) ("IntelligenceMonitor-pre-v39-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
Copy-Item $source $backup -Recurse
```

For an overridden deployment, back up `INTELLIGENCE_MONITOR_DATA_DIR` (and any separate `INTELLIGENCE_MONITOR_DB`／`INTELLIGENCE_MONITOR_SESSIONS_DIR`) instead. Verify the external copy contains `intelligence_monitor.db` and any required `sessions`／configuration files.

Reset is always two explicit steps from the repository root:

```powershell
uv run python scripts/reset_local_databases.py          # dry-run: inspect every target
uv run python scripts/reset_local_databases.py --apply  # destructive only after review
```

The helper deletes only known SQLite database files and their `-wal`／`-shm` sidecars. It deliberately leaves backups, Telegram sessions, `secret.key`, `connection.json`, directories, and volumes untouched. Restart creates a fresh v39 database (no auto-seed). Restoring an old stamped database does not upgrade it—it restores the original unsupported state.

**Stamp 39 floor (current):** `analysis_tasks.workset_id` TEXT NOT NULL DEFAULT `__user__` (same as items／user_events; delete_workset reassigns tasks to `__user__`). `worksets.external_enabled` INTEGER NOT NULL DEFAULT 1 (MCP/A2A shared visibility; empty set fail-closed). `worksets.notify_enabled` and `external_enabled` are owned by the Worksets page hub (builtin 「一般」 can turn both off). Retired `system_config` keys `mcp_workset_scope`／`mcp_workset_ids`. `ui_prefs` keys are `notify_settings`／`notify_fired`／`notify_trigger_history` (retired `voice_reminder_*`; no in-place remap). HTTP SoT is `/api/v1/ui-prefs/notify/{settings,fired,history}` — retired `/api/v1/ui-prefs/voice-reminder/*` is 404. Wire `notifyPref` is `follow`／`off` only; `"on"` is 422 (no synonym). `notify_pref` CHECK remains `follow`／`off` on `user_events`／`recurring_schedules`／`analysis_tasks` (entity checkbox; no force-on). `analysis_tasks.output_analysis_events` defaults ON as the all-mode intelligence hard gate (non-agent create omits → on; batches skip `store_results` when off). **every** DB enum CHECK is generated from a Python domain SoT (`server/domain/`) with a drift test — LLM `provider`／`staff_class`／`json_mode`／`web_search_provider`, calendar `kind`／`direction`／`origin`, timeline `source`, `action_type` + action-history `status`, `trigger_mode`, batch／source／item `status`, `analysis_time_range`, app log `level`, nullable `analysis_strategy_mode`, and `notify_pref`. No `llm_profiles.is_default`／make-default APIs; no `assistant` in `llm_staff_instances`; global slots (assistant／liaison／taskEditor) hard-bound. Fresh DDL seeds **zero** profiles (no bootstrap `__default__`). Task create／update／activate need a complete usable profile; assistant／A2A／task advisor resolve require their bound slot. Analysis modes are only `leaderboard`／`intel_event`／`agent` — recurring is **not** an analysis mode. Categories remain soft templates; free-form item details live in `notes`. Assistant must call `items.list_expiring` for expiry questions (no invention). Prior stamps ≤38 are absorbed into this floor (see CHANGELOG).

**`system_config` policy:** scalars and small non-LLM secrets only. LLM connection settings live in `llm_profiles` (column-encrypted keys). Multi-row entities, queryable secrets, or large JSON blobs belong in tables (device tokens, access keys, `ui_prefs`).

**Not planned:** merging `analysis_events` with `user_events`; hard per-category schemas; stock/qty ledgers.

## Schema support matrix

Summary of the stamp-39 wipe-only behavior above:

| Opened database | Startup behavior | Mutation |
|-----------------|------------------|---------|
| Empty, version 0 | Create v39 DDL, validate its full fingerprint, then stamp 39 | Schema creation and v39 stamp |
| Unstamped current, version 0 | Require the exact v39 fingerprint and stamp 39 | Stamp only |
| Current, version 39 | Validate the exact v39 fingerprint on every startup | None |
| Any other non-empty schema | Hard-reject with explicit reset command | None |
| Incomplete/lookalike version 0 or prior | Reject with table/column/index/foreign-key mismatch categories | None |
| Unsupported or future version | Reject; newer files are never downgraded | None |

There is no `MigrationStep` registry or content-migration ledger on stamp 39. A future in-place migration must be introduced as an explicit new contract.
