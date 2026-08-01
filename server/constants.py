"""Global constants for the backend."""

#: Fixed service port. The Electron shell and the Vite dev proxy both assume it.
SERVICE_PORT = 18820

#: Environment variable that overrides the SQLite database file path.
DB_PATH_ENV = "INTELLIGENCE_MONITOR_DB"

#: Unified local data root (secret.key, sessions/, …). Desktop → Electron userData.
DATA_DIR_ENV = "INTELLIGENCE_MONITOR_DATA_DIR"

#: Optional override for Telegram StringSession directory (default: ``{DATA_DIR}/sessions``).
SESSIONS_DIR_ENV = "INTELLIGENCE_MONITOR_SESSIONS_DIR"

#: Optional explicit bind host; LAN mode must be deliberately enabled.
HOST_ENV = "INTELLIGENCE_MONITOR_HOST"

#: Default SQLite *filename* under the unified data root (see ``server.paths.default_db_path``).
DEFAULT_DB_PATH = "intelligence_monitor.db"

#: Environment variable pointing at the built frontend (production static files).
FRONTEND_DIST_ENV = "IM_FRONTEND_DIST"

#: Brief pause after startup so scheduler/collector writes settle before competing.
STARTUP_DB_SETTLE_SECONDS = 3
