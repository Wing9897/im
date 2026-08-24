# Retired API

Index of HTTP surfaces that must stay gone. **The lock is** [`server/tests/test_dead_endpoints.py`](../server/tests/test_dead_endpoints.py) (404/405). Do **not** restore these without a new contract.

Frontend file-path lock: [`web/src/test/retiredSourcePaths.test.ts`](../web/src/test/retiredSourcePaths.test.ts).

## Health / messages / channels

| Method | Path | Replacement |
|--------|------|-------------|
| GET | `/health` | `GET /api/v1/health` |
| GET | `/api/v1/messages` | Agent `messages.search` / monitor query |
| POST | `/api/v1/channels` | Collector subscribe flows under `/api/v1/sources*` |
| GET | `/api/v1/channels/with-sources` | `GET /api/v1/channels` (`ChannelWithSource[]`) |

## Tasks / analysis control

| Method | Path | Replacement |
|--------|------|-------------|
| POST | `/api/v1/tasks/suggest` | — |
| POST | `/api/v1/tasks/chat-assistant` | Agent `tasks.consult_advisor` |
| POST | `/api/v1/tasks/{id}/preview-invalidation` | — |
| POST | `/api/v1/tasks/{id}/reset-failed` | — |
| POST | `/api/v1/tasks/{id}/acknowledge-failed` | — |
| GET | `/api/v1/tasks/{id}/project-ticks` | `GET /api/v1/tasks/{id}/agent-ticks` |
| POST | `/api/v1/system/analysis/resume` | `PUT /api/v1/config/settings` (`analysisPaused`) |
| DELETE | `/api/v1/results/batches/stats` | — |
| DELETE | `/api/v1/results/batches/failed` | — |
| POST | `/api/v1/results/batches/{id}/retry` | Live retry is on the batch resource under `/api/v1/results/batches*` |

## Actions / stats / config

| Method | Path | Replacement |
|--------|------|-------------|
| GET | `/api/v1/actions/history` | `GET /api/v1/actions/trigger-history` |
| GET | `/api/v1/actions/{id}/history` | `GET /api/v1/actions/trigger-history` |
| GET | `/api/v1/actions/stats` | — |
| GET/PUT | `/api/v1/config/values` | `GET/PUT /api/v1/config/settings` |
| GET/PUT | `/api/v1/config/retention` | `GET/PUT /api/v1/config/settings` |
| POST | `/api/v1/config/api-key/generate` | Access-key routes under `/api/v1/setup` / `/api/v1/access-keys` |
| GET | `/api/v1/config/api-key/status` | Access-key routes |

LLM provider slots / `assistant_llm_*` on settings: use `/api/v1/llm/profiles` and `/api/v1/llm/global-slots`.

## Results / viewer aliases

| Method | Path | Replacement |
|--------|------|-------------|
| GET | `/api/v1/results/benefits` | Intelligence `/api/v1/results/events` |
| GET | `/api/v1/results/schedule` | Calendar `/api/v1/calendar/*` |
| GET | `/api/v1/results/calendar` | `/api/v1/calendar/window` |
| GET | `/api/v1/viewer/results/leaderboard` | Viewer `/api/v1/viewer/*` live routes |
| GET | `/api/v1/viewer/results/benefits` | — |
| GET | `/api/v1/viewer/results/timeline` | — |

## Calendar / timeline aliases

| Method | Path | Replacement |
|--------|------|-------------|
| GET | `/api/v1/calendar/items` | Trackable items `/api/v1/items*` + window `source=item_remind` |
| GET | `/api/v1/calendar/occurrences` | `/api/v1/calendar/window` (SPA／notify) or Python `query_window`／`expand_active_calendar_occurrences` (Agent／MCP) |
| POST | `/api/v1/calendar-imports/preview` | `POST /api/v1/calendar/imports/preview` |
| POST | `/api/v1/calendar-imports/commit` | `POST /api/v1/calendar/imports/commit` |
| * | `/api/v1/timeline/dismissals` | `/api/v1/calendar/dismissals` |
| * | `/api/v1/user-events` | `/api/v1/calendar/user-events` |

## Setup / reset / schema gate

| Method | Path | Replacement |
|--------|------|-------------|
| POST | `/api/v1/setup/bootstrap` | Admin password + device session |
| POST | `/api/v1/setup/pairing-code` | — |
| POST | `/api/v1/setup/pair` | — |
| POST | `/api/v1/setup/login-with-api-key` | Automation keys stay Bearer-only |
| POST | `/api/v1/system/reset/runtime` | `POST /api/v1/system/reset/database` |
| GET | `/api/v1/system/schema/status` | Schema contract: [`SCHEMA-BASELINE.md`](./SCHEMA-BASELINE.md) |
| POST | `/api/v1/system/schema/upgrade` | Explicit reset: `python scripts/reset_local_databases.py --apply` |

## Collector accounts (hard-cut)

All `/api/v1/accounts*` paths stay 404. Live collector surface is `/api/v1/sources*`.

## LLM / UI prefs

| Method | Path | Replacement |
|--------|------|-------------|
| POST | `/api/v1/llm/profiles/{id}/set-default` | Hard-bound global slots only |
| GET/PUT | `/api/v1/ui-prefs/schedule/emojis` | Entity `emoji` columns |
| GET/PUT | `/api/v1/ui-prefs/tasks/emojis` | Entity `emoji` columns |
| GET/PUT | `/api/v1/ui-prefs/voice-reminder/*` | `/api/v1/ui-prefs/notify/{settings,fired,history}` |
