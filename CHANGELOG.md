# Changelog

Stable product baseline starts at **1.0.0**. Schema stamp／`SCHEMA_SEMVER` identify the wipe-only database contract and need not match the product tag.

## [Unreleased]

- Stamp 29 fresh DDL no longer seeds a bootstrap Ollama `__default__` profile (schema shape unchanged — no stamp bump). Existing DBs keep prior rows until deleted. Tasks／assistant require a **complete** profile (name+provider+model; ollama needs `base_url`; cloud providers need `api_key`); incomplete／missing → 400. First user-created profile becomes default.
- Wipe-only SQLite baseline **stamp 29** (`SCHEMA_SEMVER` `0.1.0-beta.30`): `llm_profiles` + `llm_staff_instances` replace dual-path global／`assistant_llm_*` system_config slots; tasks require `llm_profile_id`; REST `/api/v1/llm/profiles` and `/staff-instances`
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
