# Changelog

Stable product baseline starts at **1.0.0**. Schema stamp／`SCHEMA_SEMVER` identify the wipe-only database contract and need not match the product tag.

## [Unreleased]

- Calendar public holidays: `GET /api/v1/calendar/holidays` (Nager.Date) uses the household weather location; country-level overlay on 時間規劃, not a second region picker.
- Household pipeline graph: four layers (來源＋物品 → 任務＋助手 → 工作集 → 輸出：時間規劃／情報頁／通知／外部接口). L4 edges leave the 工作集 **block** layer port, not each card. Notify／external gates stay card icons and do not hide L4 wires.
- Household pipeline graph: drop 我的日程 as a column block (calendar overlays all work); move 助手 to layer 2 with items/tasks, wired to 工作集. Calendar APIs／`/assistant` unchanged.
- Wipe-only SQLite baseline **stamp 40** (`SCHEMA_SEMVER` `0.1.0-beta.41`): `user_events.notify_pref` and `recurring_schedules.notify_pref` DEFAULT `'off'` (align create-omit and `DEFAULT_CALENDAR_NOTIFY_PREF`). `analysis_tasks.notify_pref` stays `'follow'`. Worksets DDL extracted to `schema_domains/worksets.py` (must precede tasks in `DDL_PARTS`).
- Local-notify symbols: Pydantic / ui_prefs / FE scanner `VoiceReminder*` → `Notify*`; catalog id `local-notify`; trigger-history source `notify`. Retired `/ui-prefs/voice-reminder/*` stays 404. `/ai/voice` STT-TTS unchanged.
- Calendar occurrences: `GET /api/v1/calendar/occurrences` (query unchanged). Retired `GET /api/v1/calendar/items` → 404.
- Builtin task templates: intel catalog is eight jobs (關鍵情報摘要、時間行程推理、IoT 設備告警、薅羊毛情報、行程事件提取、資安詐騙警示、政策法規動態、金融市場要聞); 專案經理 catalog is 通用專案日期管理 + 工作輪更表. Removed extra intel/leaderboard variants and overlapping Agent web-scout intel templates. In-editor Agent chips 專案調和／網蒐 unchanged.
- Leaderboard tasks (`analysis_mode=leaderboard`) create with `outputAnalysisEvents` off; they always persist `trending_topics` for 排行榜 + may notify, and never wire to 情报页. No schema stamp.

- Prior wipe-only floor **stamp 39** (`SCHEMA_SEMVER` `0.1.0-beta.40`): `analysis_tasks.workset_id` TEXT NOT NULL DEFAULT `__user__` (same as items／user_events). Create/update omit or empty → 一般. Delete workset reassigns tasks to `__user__` (no SET NULL). Household graph always-on workset→时间规划 (display + navigate; no workset-level includeInTimeline column).
- Prior wipe-only floor **stamp 38** (`SCHEMA_SEMVER` `0.1.0-beta.39`): `worksets.external_enabled` (MCP+A2A shared; default on; builtin 「一般」 can turn off). Retired `mcp_workset_scope`／`mcp_workset_ids`. Worksets page is the permission hub (通知 + 外部接口); notify and MCP/A2A pages link there. Calendar 我的日程 and in-app assistant are not gated.
- Prior wipe-only floor **stamp 37** (`SCHEMA_SEMVER` `0.1.0-beta.38`): `ui_prefs` keys `notify_*`; HTTP `/api/v1/ui-prefs/notify/*` (retired `/voice-reminder/*` → 404); `notifyPref` `"on"` rejected with 422

- Household **A2A** master switch `a2a_enabled` (default on) on 外部接口 → A2A, independent of `mcp_enabled`. When off, `POST /api/v1/a2a/agent` returns 403. Shared `mcp_cap_*` groups still show on both tabs. Access keys stay identity-only. No schema stamp.

- Household capability groups (`mcp_cap_*`) now gate **both** MCP tools and the A2A agent tool loop; the same matrix is shown on 外部接口 → MCP and → A2A. Access keys stay identity-only (`*`). No schema stamp.

- Calendar create/edit: a **現在**／Now button next to date/time fills the local clock (all-day → today only) on 我的日程 one-off, recurring timed fields, and item-linked calendars
- Calendar create defaults 通知 unchecked (`notifyPref: "off"`) for user events and recurring series (omit on API create also `off`); edit still loads the saved value. Analysis-task notify stays `follow`. No schema stamp bump (DDL DEFAULT remains `follow`)
- Notify channels: 语音 and 闪现 are independent (either / both / neither). Quick toggles live on the bell cluster and the last-day drawer header; 闪现 is a dedicated top full-width bar (timed ~10s or persistent until dismiss), not the operational toast.
- UI copy: ping switches say **通知**／Notify; calendar lead time says **提前天數**／Days ahead (no shared 提醒)
- Prior wipe-only floor **stamp 36** (`SCHEMA_SEMVER` `0.1.0-beta.37`): `notify_pref` CHECK is `follow`／`off` (entity notify checkbox; no force-on)
- Notify IA: editors use a simple notify checkbox (checked = follow workset; unchecked = mute this row). Workset on/off lives on the Notifications page. Resolve order: global/DND → entity off → `worksets.notify_enabled`
- Prior wipe-only floor **stamp 35** (`SCHEMA_SEMVER` `0.1.0-beta.36`): `analysis_tasks.output_analysis_events` defaults ON as the all-mode intelligence hard gate (off → skip `store_results`)
- Task editor groups three outputs: intelligence (`outputAnalysisEvents` hard skip-store), time planning (`includeInTimeline`), notify (`notifyPref` follow／off)
- Prior wipe-only floor **stamp 34** (`SCHEMA_SEMVER` `0.1.0-beta.35`): `worksets.notify_enabled` (builtin 「一般」 defaults on); `user_events`／`recurring_schedules`／`analysis_tasks.notify_pref` (`follow`／`on`／`off`) CHECK from Python SoT with drift tests
- Prior wipe-only floor **stamp 33** (`SCHEMA_SEMVER` `0.1.0-beta.34`): every remaining DB enum CHECK generated from `server/domain/` Python SoT with drift tests — `action_type` (+ handler registry), action-history／batch／source／item `status`, `trigger_mode`, `analysis_time_range`, app log `level`, new CHECKs for `json_mode`／`web_search_provider` (Literal-typed on the wire), and nullable `analysis_strategy_mode`
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
