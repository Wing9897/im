"""Telegram session storage without Telethon SQLite session files.

Telethon defaults to ``SQLiteSession`` (``.session``), which is a second SQLite
database that commonly reports ``database is locked`` when a stale dev server
or a crashed connect leaves the file open. We persist a ``StringSession`` token
in ``{sessions_dir}/{account_id}.session.txt`` instead.

``sessions_dir`` resolves via ``server.paths`` — Desktop uses
``{DATA_DIR}/sessions`` (Desktop userData / CLI same default product data root).
"""

from __future__ import annotations

from pathlib import Path

from telethon.sessions import StringSession


def string_session_path(session_dir: str, account_id: str) -> Path:
    return Path(session_dir) / f"{account_id}.session.txt"


def persist_string_session_token(session_dir: str, account_id: str, token: str) -> Path:
    """Write the StringSession token; raises ``ValueError`` when *token* is empty."""
    cleaned = (token or "").strip()
    if not cleaned:
        raise ValueError(f"Refusing to persist empty Telegram session for account {account_id}")
    Path(session_dir).mkdir(parents=True, exist_ok=True)
    path = string_session_path(session_dir, account_id)
    path.write_text(cleaned, encoding="utf-8")
    return path


def load_string_session(session_dir: str, account_id: str) -> StringSession:
    """Load a persisted string session token; empty session when absent."""
    Path(session_dir).mkdir(parents=True, exist_ok=True)

    token_file = string_session_path(session_dir, account_id)
    if token_file.exists():
        token = token_file.read_text(encoding="utf-8").strip()
        if token:
            return StringSession(token)

    return StringSession()
