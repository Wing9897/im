# Changelog

Stable product baseline starts at **1.0.0**. Schema stamp／`SCHEMA_SEMVER` identify the wipe-only database contract and need not match the product tag.

## [Unreleased]

- `GET /api/v1/calendar/window` query range is `startTime`／`endTime` only (short `start`／`end` aliases removed).
- Agent schedule／threshold ticks that write Intelligence events (`outputAnalysisEvents`) now persist `tool_calls_json` and `agent_message` on the batch. Scout ticks no longer show empty tools after Serper／web.search.
- SQLite contract cut: **stamp 1** (`SCHEMA_SEMVER` `1.0.0`) is the first database version. Live DDL matches the former stamp-45 shape; retired stamps (including 2–45) hard-reject with no in-place migration → `uv run python scripts/reset_local_databases.py --apply`. See [SCHEMA-BASELINE](docs/SCHEMA-BASELINE.md).
- SPA notifications workspace page is `NotifyWorkspacePage` (`web/src/pages/notify/`; route `/notify`; tabs `types`／`notify`／`history`). HTTP `/api/v1/actions*` outbound automation unchanged. Unique `TimelineCalendarRendering` assertions moved into CalendarView／GanttView／ControlBar tests; that file is deleted. Dual-path `sharedCalendarFetch` (`/results/events` + `/calendar/occurrences`) is gone — notify scan now uses the same `GET /api/v1/calendar/window` as Timeline/Board.
- `GET /api/v1/channels` is the live channel list (`ChannelWithSource[]`). Retired `GET /api/v1/channels/with-sources` → 404.
- Test de-dupe (timeline / workset graph / notify) and unused-i18n scan on `npm run i18n:check`.

## [1.0.0] — baseline

First documented stable release line for Intelligence Monitor (Desktop + CLI + Docker/Web).

### Highlights

- Collector connections under `/api/v1/sources*` (`sources` / `source_channels` / `messages.source_id`)
- Wipe-only SQLite baseline **stamp 1** (`SCHEMA_SEMVER` `1.0.0`); non-current stamps hard-reject → explicit reset. (The 1.0.0 product tag historically documented stamp 27 / `0.1.0-beta.28` — that lineage is retired; see [SCHEMA-BASELINE](docs/SCHEMA-BASELINE.md).)
- `user_events.kind` (`normal`|`expires`|`purchase_effective`) is authority for expiry projection and finance; title presets remain UX only
- Remove item-level `price`; purchase_effective linked calendars carry `amount` + `direction` (`expense`|`income`)
- Task modes: `leaderboard` / `intel_event` / `agent`; recurring calendars are standalone `/api/v1/calendar/recurring` series
- Household auth: admin password → device session; revocable access keys; retired pairing / API-key mint bridges stay gone
- OpenAPI-sourced HTTP contract (`web/openapi/openapi.json` + generated `schema.d.ts`)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md) for live contract detail.
