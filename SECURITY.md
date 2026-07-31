# Security Policy

## Supported versions

Only the latest release is supported. The project is in beta (`0.1.0-beta.5`) and
there are no backports to earlier tags.

| Version | Supported |
|---------|-----------|
| latest release | yes |
| anything older | no |

## Threat model (local-first)

Intelligence Monitor is a self-hosted, single-household application. It is designed
to run on the operator's own machine, not as a multi-tenant service.

- **Network exposure** — the server binds `127.0.0.1` by default. It is only reachable
  from other machines if you deliberately set `INTELLIGENCE_MONITOR_HOST=0.0.0.0`
  (or a specific NIC) and open the firewall for port `18820`. There is no built-in TLS;
  if you expose it beyond loopback, put it behind a reverse proxy you control.
- **Data at rest** — everything lives in one SQLite file under the local data root
  (`{DATA_DIR}/intelligence_monitor.db`). Source credentials (Telegram sessions, IMAP,
  MQTT, provider keys) are encrypted with Fernet using `{DATA_DIR}/secret.key`, and the
  admin password is hashed with argon2. **`secret.key` is the crown jewel**: anyone who
  can read the data directory can decrypt the stored credentials, so protect it with
  normal OS file permissions and full-disk encryption. It is not escrowed anywhere —
  lose it and the encrypted values are unrecoverable.
- **Authentication** — the `localhost_auth_exempt` bypass exists only for the very first
  `POST /api/v1/setup/register` on a fresh install. Once an admin exists, loopback is no
  longer exempt and every request needs a device session token or an API key. Password
  reset without the old password is restricted to loopback.
- **LLM providers and API keys** — you supply your own keys for Ollama / OpenAI / Gemini /
  OpenRouter, and they are stored in your local database. Collected messages and prompts
  are sent to whichever provider you configure; the project itself has no backend and
  collects no telemetry. Provider cost, quota, and terms of service are your
  responsibility.
- **Collected content** — you are responsible for having the right to collect from the
  Telegram / Discord / RSS / MQTT / Email sources you configure, and for complying with
  those platforms' terms.

## Reporting a vulnerability

Please **do not** open a public issue for an exploitable bug. Instead:

- Open a private security advisory on GitHub (repository → **Security** → *Report a vulnerability*), or
- Email **tomt99688@gmail.com**

Helpful details: affected version, OS, whether the instance was loopback-only or exposed,
reproduction steps, and the impact you observed.

This is a small project maintained in spare time, so responses are best-effort — there is
no guaranteed response or fix window. Reports that turn out to be real issues will be
fixed in the next release and credited in `CHANGELOG.md` if you want the credit.
