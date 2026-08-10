# Changelog

Stable product baseline starts at **1.0.0**. Schema stamp／`SCHEMA_SEMVER` identify the wipe-only database contract and need not match the product tag.

## [1.0.0] — baseline

First documented stable release line for Intelligence Monitor (Desktop + CLI + Docker/Web).

### Highlights

- Collector connections under `/api/v1/sources*` (`sources` / `source_channels` / `messages.source_id`)
- Wipe-only SQLite baseline **stamp 24** (`SCHEMA_SEMVER` `0.1.0-beta.25`); non-current stamps hard-reject → explicit reset
- Remove item-level `price`; purchase/effective linked calendars carry `amount` + `direction` (`expense`|`income`)
- Task modes: `leaderboard` / `intel_event` / `recurring` / `agent`
- Household auth: admin password → device session; revocable access keys; retired pairing / API-key mint bridges stay gone
- OpenAPI-sourced HTTP contract (`web/openapi/openapi.json` + generated `schema.d.ts`)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md) for live contract detail.
