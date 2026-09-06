[繁體中文](README.md) | [简体中文](README.zh-Hans.md) | [English](README.en.md)

# <img src="docs/images/logo.png" width="32" height="32" alt=""> Intelligence Monitor

A local-first household intelligence workstation: ingest Telegram, Discord, RSS, MQTT, Email, and more; let AI turn messages into intel and events; then place them on the calendar, tasks, items, and map. The assistant can answer questions or update the schedule.

## Screenshots

![Month calendar and the day's agenda](docs/images/schedule_calendar.png)

Month calendar and the day's agenda.

![AI staff roles](docs/images/AIstaff_introduce.png)

Assistant, account manager, and back-office analyst roles.

![Assistant chat](docs/images/chat_page.png)

Chat with the assistant to search intel or change the schedule.

![Intelligence map](docs/images/intelligence_map.png)

Intel events on the map.

![Item inventory](docs/images/item.png)

Item inventory and expiry.

![Analysis tasks](docs/images/mission.png)

Analysis tasks and monitor setup.

## Getting started

1. **Download or run locally** — install Desktop from [GitHub Releases](https://github.com/Wing9897/im/releases) (Windows / macOS / Linux). For development:

   ```bash
   uv sync --extra dev --locked
   npm ci
   npm run dev
   ```

2. **First run** — create the household admin. On Desktop, host locally or connect to an existing remote server.
3. **Sign in** — use the same account after that.
4. **Create a workset** — sidebar **Worksets** → New. Use it to group intel, events, and items (or start with the built-in General workset).
5. **Add a source / intel** — **Sources** for Telegram, Discord, RSS, MQTT, Email, and more; the intel pages show events and leaderboards.
6. **Calendar and tasks** — **Timeline** for month / Gantt; **Tasks** to set what to monitor and analyze. Recurring calendar series expand RRULE at query time only and never trigger AI analysis. AI schedules support 10-second, hourly, daily, weekly, and custom-second presets.
7. **Assistant** — `Ctrl+J` (macOS `⌘+J`) anytime, or open the assistant page. Configure an AI provider in Settings first.
8. **Settings** — language, AI, notifications, and external interfaces. Create access keys on the Account page.

If an older database will not start after upgrade: current is **schema stamp 7** (`SCHEMA_FLOOR` = current; production `SCHEMA_MIGRATIONS` is empty). Stamps 1–6 **hard-reject** — back up, then reset. For a **future stamp**, **update the application** first. Stop Desktop / `npm run dev`, then:

```bash
uv run python scripts/reset_local_databases.py --apply
```

## External agents / MCP

Any Streamable HTTP MCP client can connect to `{API origin}/api/v1/mcp` (structured tools, not chat). Create a scope `*` access key on Account, then open **Settings → External interfaces → MCP** for the master switch and capability groups. OpenClaw is one example client. Contract: [`docs/agent/mcp.md`](docs/agent/mcp.md).

For one-shot natural-language assign (the local runtime picks tools), use A2A (`POST /api/v1/a2a/agent`): [`docs/agent/a2a.md`](docs/agent/a2a.md).

## Calendar share (optional)

Public hub: **https://subscribe.devents.tech**. This app talks to it only through `/api/v1/calendar-share/*`; the UI never calls the hub directly.

## Developers

```bash
uv sync --extra dev --locked
npm ci
npm run dev
npm run check
```

Python ≥ 3.11, Node.js ≥ 20.19.0. On Windows, a 0-byte `node` / `npm` stub in `C:\Windows\System32\` can shadow the real Node. Run `npm run check` before a PR (same Ubuntu quality gate as CI). `zh-Hant` is the UI-copy source of truth. Report security issues via [`SECURITY.md`](SECURITY.md), not a public issue.

Remaining contracts: [`docs/README.md`](docs/README.md). MIT ([`LICENSE`](LICENSE)).
