# Authentication

Two credential families are accepted by `verify_auth` (either is enough):

1. **Device session** — opaque access (1h) + refresh (90d) tokens from admin register/login. Hashes only in `device_sessions` / `device_access_tokens`. Used for everyday UI / SSE (`Authorization: Bearer` or SSE `?token=`).
2. **API access keys** — household keys in `access_api_keys` table (SHA-256 hash only; plaintext returned once on create). JSON `scopes` (default `["*"]` full; `["read"]` GET-only). Enforced in `server.household_auth` (`verify_auth` / `verify_write_access`). Intended for Webhook / automation / scripts / A2A / MCP; create/revoke via `GET/POST/DELETE /api/v1/access-keys` only (legacy `POST/GET /api/v1/config/api-key/*` removed). Account UI (`/account/keys`) only creates `*` keys (no read-only / scopes picker); existing `read` keys still work and show as read-only status.

Household identity is a **single admin account** (`admin_accounts`: argon2 password hash). Pairing codes are removed.

## Auth resource map

Do **not** merge these surfaces — lifecycles differ:

| Resource | Path prefix | Role |
|----------|-------------|------|
| Admin + device session | `/api/v1/setup/*` | Everyday UI auth: register, login, change/reset password, refresh, logout, list/revoke devices |
| Access key CRUD | `/api/v1/access-keys` | Household automation secrets (Webhook / scripts / A2A / MCP); UI at `/account/keys` (create always `*`). Bearer API keys authenticate automation only — they do **not** mint UI device sessions |
| A2A | `/api/v1/a2a/agent` | External agents; natural-language LLM agent (single-shot); **access key + `*` only** (no device session). Household master `a2a_enabled` (default on) closes this HTTP when off. Tool loop is also gated by household `mcp_cap_*` and `worksets.external_enabled` (same as MCP). See [`docs/agent/a2a.md`](agent/a2a.md) |
| MCP | `/api/v1/mcp` | External agents; Streamable HTTP structured tools (calendar／messages／intelligence／items allowlist); **same access-key + `*` gate as A2A** (no device session, no local LLM). Household master `mcp_enabled` (default on) is independent of A2A. Capability groups `mcp_cap_*` are household settings, not key scopes. Workset visibility is `worksets.external_enabled` on the Worksets page. See [`docs/agent/mcp.md`](agent/mcp.md) |

## Desktop ↔ Web connection vocabulary

Single mapping (do not invent a third vocabulary). Implemented in `web/src/electron/electronConnection.ts`:

| Desktop (`connection.json` `mode`) | Web UI / store | Meaning |
|------------------------------------|----------------|---------|
| `host` | `local` | This machine runs the sidecar; UI talks to localhost |
| `client` | `remote` | UI talks to a remote server URL; no local sidecar |

Setup routes (`/api/v1/setup/*`):

| Endpoint | Auth | Role |
|----------|------|------|
| `GET /api/v1/setup/status` | Public | `{ bootstrapped, hasAdmin, hasActiveDevice, credentialsConfigured, localhostAuthExempt, resetPasswordForLocal }` |
| `POST /api/v1/setup/register` | Loopback + no admin yet | Create singleton admin + first device session; sets `setup_complete=true` + `localhost_auth_exempt=false` |
| `POST /api/v1/setup/login` | Public (needs admin) | Username/password → new device session (any client, including LAN / Desktop client) |
| `POST /api/v1/setup/change-password` | Bearer | `{ currentPassword, newPassword }` |
| `POST /api/v1/setup/reset-password` | Loopback + armed | `{ username, newPassword }` — requires `connection.json` `resetPasswordForLocal: true` (file write permission); flag auto-clears after success |
| `POST /api/v1/setup/refresh` | Public (body refresh) | Atomic rotate access (+ refresh); CAS on refresh hash |
| `POST /api/v1/setup/logout` | Access / API key | Revoke current device session |
| `GET/DELETE /api/v1/setup/devices` | Access / API key | List / revoke devices |

**Removed:** `POST /setup/bootstrap`, `/pairing-code`, `/pair`; CLI / sidecar startup pairing banner; loopback unauthenticated mint.

Other notes:

- **Action credentials** stored as encrypted configuration; API responses replace tokens, webhook URLs, passwords, and header values with placeholders that are preserved on edit
- **Localhost bypass** — `localhost_auth_exempt` (default true for fresh installs). After register / password login it is set to **false**, so loopback must present a valid Bearer like any other client for normal API routes. Loopback-only exceptions: `register` (first admin) and file-armed `reset-password`.
- **Local password rescue** — default **off**. Owner arms by setting `resetPasswordForLocal: true` in `{DATA_DIR}/connection.json` (requires OS write access to that file). UI exposes forgot-password only when status reports the flag; successful reset clears the flag (one-shot).
- **Bootstrap semantics** — `bootstrapped` / `hasAdmin` are true when an `admin_accounts` row exists. Revoking all device sessions does **not** clear the admin; recovery is password login (or armed loopback `reset-password` then login).
- **Household credential = trust boundary** — a device access token or an API key with `*` grants the same write access as loopback (POST/PUT/PATCH/DELETE). An API key with only `read` may use safe methods (GET/HEAD/OPTIONS) across the API; write methods require `*`. There is no per-user ACL.
- **Write protection without a credential** — remote clients without a valid Bearer cannot mutate data (403 on write attempts that reach `verify_write_access`; missing/wrong token is rejected by `verify_auth` with 401). When neither API keys nor device sessions exist, remote clients get 503 `AUTH_SETUP_REQUIRED`.
- **Bind policy** — the server always binds `0.0.0.0` by default (`DEFAULT_BIND_HOST`; Desktop sidecar sets `INTELLIGENCE_MONITOR_HOST=0.0.0.0`). There is no user-facing LAN toggle. Remote requests still require a credential (device session or API key). Open firewall port `18820` on LAN. **Port-forward / internet exposure must terminate TLS at Caddy/Nginx (or similar); the app does not serve HTTPS. TLS is not required for LAN-only use.**
- **Admin password vs API keys** — username/password + device sessions are for everyday UI (browsers, Desktop). API keys remain for Webhook / HTTP push / scripts.
- **First-run (Web)** — after health succeeds: `GET /setup/status` → no admin → register; admin but no session → login. Desktop still chooses host/client for connection target only (no pairing code).
- **Desktop host vs client** — see [Desktop ↔ Web connection vocabulary](#desktop--web-connection-vocabulary). All Desktop↔Web store sync goes through `electronConnection.ts` (`syncDesktopConnectionOnBoot` / `ensureDesktopHostMode` / `ensureDesktopClientMode`); App/Wizard must not call `resetToLocalConnectionDefaults` directly. Remote Desktop restart must not write `remote` into the host origin store before `restartShell`. Profile logout on a client resets shell to host.

## Manual verification checklist

- Desktop host: Local register → loopback without Bearer returns 401; with device access the app loads
- LAN / second device: same admin username/password login succeeds; reload keeps session
- Forgotten password: arm `resetPasswordForLocal` in `connection.json` → loopback `reset-password` → login; remote / unarmed reset rejected
- Webhook/script calls use a **full** API key (`scopes` containing `*`) from Account via `Authorization: Bearer`（A2A-only keys cannot `POST /messages`）
- Profile logout returns to login; Desktop client logout resets to host shell
- Local STT / local notifications unchanged when already signed in
- CLI (`python -m server`) does **not** print a pairing code
