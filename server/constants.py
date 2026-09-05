"""Global constants for the backend."""

#: Fixed default listen port (SoT). FE ``DEFAULT_API_PORT``, desktop
#: ``DEFAULT_SERVER_PORT``, and ``scripts/service-ports.mjs`` must match
#: (drift-tested). Override bind host via ``HOST_ENV``; the port itself is fixed.
SERVICE_PORT = 18820

#: Default uvicorn bind host — all interfaces so LAN clients can reach the API.
#: Auth still required; TLS only needed for public internet exposure.
DEFAULT_BIND_HOST = "0.0.0.0"

#: Environment variable that overrides the SQLite database file path.
DB_PATH_ENV = "INTELLIGENCE_MONITOR_DB"

#: Unified local data root (secret.key, sessions/, …). Desktop → Electron userData.
DATA_DIR_ENV = "INTELLIGENCE_MONITOR_DATA_DIR"

#: Optional override for Telegram StringSession directory (default: ``{DATA_DIR}/sessions``).
SESSIONS_DIR_ENV = "INTELLIGENCE_MONITOR_SESSIONS_DIR"

#: Optional override for bind host (default: ``DEFAULT_BIND_HOST`` / all interfaces).
HOST_ENV = "INTELLIGENCE_MONITOR_HOST"

#: Optional override for the Fernet ``secret.key`` file (default: ``{DATA_DIR}/secret.key``).
SECRET_KEY_FILE_ENV = "INTELLIGENCE_MONITOR_SECRET_KEY_FILE"

#: Default SQLite *filename* under the unified data root (see ``server.paths.default_db_path``).
DEFAULT_DB_PATH = "intelligence_monitor.db"

#: Environment variable pointing at the built frontend (production static files).
FRONTEND_DIST_ENV = "IM_FRONTEND_DIST"

#: Script-only: bearer token for ``scripts/verify_*`` smoke runs (never read by the server).
ACCESS_TOKEN_ENV = "IM_ACCESS_TOKEN"

#: Every ``INTELLIGENCE_MONITOR_*`` / ``IM_*`` name the backend or its scripts read;
#: add new env names here so docs/tests have one list to check against.
ALL_ENV_NAMES = (
    DB_PATH_ENV,
    DATA_DIR_ENV,
    SESSIONS_DIR_ENV,
    HOST_ENV,
    SECRET_KEY_FILE_ENV,
    FRONTEND_DIST_ENV,
    ACCESS_TOKEN_ENV,
)

#: Brief pause after startup so scheduler/collector writes settle before competing.
STARTUP_DB_SETTLE_SECONDS = 3
