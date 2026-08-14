# Changelog

Stable product baseline starts at **1.0.0**. Schema stamp／`SCHEMA_SEMVER` identify the wipe-only database contract and need not match the product tag.

## [Unreleased]

- Wipe-only SQLite baseline **stamp 33** (`SCHEMA_SEMVER` `0.1.0-beta.34`): every remaining DB enum CHECK generated from `server/domain/` Python SoT with drift tests — `action_type` (+ handler registry), action-history／batch／source／item `status`, `trigger_mode`, `analysis_time_range`, app log `level`, new CHECKs for `json_mode`／`web_search_provider` (Literal-typed on the wire), and nullable `analysis_strategy_mode`
- Prior wipe-only floor **stamp 32** (`SCHEMA_SEMVER` `0.1.0-beta.33`): LLM `provider`／`staff_class` CHECK from Python SoT; drop `llm_staff_instances.assistant` + `is_default`／make-default; hard-bound assistant／liaison／taskEditor global slots; calendar `kind`／`direction` CHECK from domain SoT; non-current stamps hard-reject → explicit reset
- Prior wipe-only floor **stamp 31** (`SCHEMA_SEMVER` `0.1.0-beta.32`): CHECK SoT for `user_events.origin`／timeline `source`; `user_events.item_id`／`recurring_schedules.item_id` → `REFERENCES items(id) ON DELETE SET NULL`
- Prior wipe-only floor **stamp 30** (`SCHEMA_SEMVER` `0.1.0-beta.31`): `user_events.origin` includes `mcp` for the MCP tool channel
- Stamp 29 fresh DDL no longer seeds a bootstrap Ollama `__default__` profile (schema shape unchanged — no stamp bump). Existing DBs keep prior rows until deleted. Tasks／assistant require a **complete** profile (name+provider+model; ollama needs `base_url`; cloud providers need `api_key`); incomplete／missing → 400.
- Prior wipe-only floor **stamp 29** (`SCHEMA_SEMVER` `0.1.0-beta.30`): `llm_profiles` + `llm_staff_instances` replace dual-path global／`assistant_llm_*` system_config slots; tasks require `llm_profile_id`; REST `/api/v1/llm/profiles` and `/staff-instances`
- Prior wipe-only floor **stamp 28** (`SCHEMA_SEMVER` `0.1.0-beta.29`): drop `items.expires_at`／`remind_before_days` (derive-on-read from linked `kind=expires`); timeline source `item` → `item_remind`

## [1.0.0] — baseline

First documented stable release line for Intelligence Monitor (Desktop + CLI + Docker/Web).

### Highlights

- Collector connections under `/api/v1/sources*` (`sources` / `source_channels` / `messages.source_id`)
- Wipe-only SQLite baseline **stamp 27** (`SCHEMA_SEMVER` `0.1.0-beta.28`); non-current stamps hard-reject → explicit reset
- `user_events.kind` (`normal`|`expires`|`purchase_effective`) is authority for expiry projection and finance; title presets remain UX only
- Remove item-level `price`; purchase_effective linked calendars carry `amount` + `direction` (`expense`|`income`)
- Task modes: `leaderboard` / `intel_event` / `agent`; recurring calendars are standalone `/api/v1/calendar/recurring` series
- Household auth: admin password → device session; revocable access keys; retired pairing / API-key mint bridges stay gone
- OpenAPI-sourced HTTP contract (`web/openapi/openapi.json` + generated `schema.d.ts`)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md) for live contract detail.
