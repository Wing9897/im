# Changelog

Stable product baseline starts at **1.0.0**. Schema stamp／`SCHEMA_SEMVER` identify the wipe-only database contract and need not match the product tag.

## [Unreleased]

- Wipe-only SQLite baseline **stamp 45** (`SCHEMA_SEMVER` `0.1.0-beta.46`): `llm_profiles.web_search_provider` CHECK adds `serper`; column-encrypted `serper_search_api_key` (same pattern as Brave／Tavily／Perplexity). Missing keyed-search keys fail closed (no silent DuckDuckGo fallback). Assistant `web.fetch` reads 1–2 public HTML pages when tool search is on (no extra column). Prior stamps ≤44 hard-reject → `uv run python scripts/reset_local_databases.py --apply`. Stamps 27–44 are absorbed into the [SCHEMA-BASELINE](docs/SCHEMA-BASELINE.md) floor. This does **not** migrate in place — reset local DBs after upgrading.
- Wipe-only SQLite baseline **stamp 44** (`SCHEMA_SEMVER` `0.1.0-beta.45`): `llm_profiles.web_search_provider` CHECK adds `tavily`／`perplexity`; column-encrypted `tavily_search_api_key`／`perplexity_search_api_key` (same pattern as Brave). Absorbed by stamp 45.
- SPA notifications workspace page is `NotifyWorkspacePage` (`web/src/pages/notify/`; route `/notify`; tabs `types`／`notify`／`history`). HTTP `/api/v1/actions*` outbound automation unchanged. Unique `TimelineCalendarRendering` assertions moved into CalendarView／GanttView／ControlBar tests; that file is deleted. Dual-path `sharedCalendarFetch` (`/results/events` + `/calendar/occurrences`) is gone — notify scan now uses the same `GET /api/v1/calendar/window` as Timeline/Board.
- `GET /api/v1/channels` is the live channel list (`ChannelWithSource[]`). Retired `GET /api/v1/channels/with-sources` → 404.
- Test de-dupe (timeline / workset graph / notify) and unused-i18n scan on `npm run i18n:check`.

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
