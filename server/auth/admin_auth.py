"""Single household admin account: argon2 password hash + singleton row."""

from __future__ import annotations

import re
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from server.db.database import Database
from server.util import new_id, utc_now_iso

_PASSWORD_HASHER = PasswordHasher()

USERNAME_MIN_LEN = 1
USERNAME_MAX_LEN = 64

# Normalized usernames: lowercase ASCII letters, digits, underscore, dot, hyphen.
_USERNAME_RE = re.compile(r"^[a-z0-9._-]+$")


class AdminAuthError(ValueError):
    """Raised for invalid username/password policy input."""

    def __init__(self, message: str, *, code: str = "VALIDATION_ERROR") -> None:
        super().__init__(message)
        self.code = code


def normalize_username(username: str) -> str:
    return (username or "").strip().lower()


def validate_username(username: str) -> str:
    normalized = normalize_username(username)
    if len(normalized) < USERNAME_MIN_LEN or len(normalized) > USERNAME_MAX_LEN:
        raise AdminAuthError(
            f"Username must be {USERNAME_MIN_LEN}–{USERNAME_MAX_LEN} characters",
        )
    if not _USERNAME_RE.fullmatch(normalized):
        raise AdminAuthError(
            "Username may only contain letters, digits, '.', '_' and '-'",
        )
    return normalized


def validate_password(password: str) -> str:
    """Accept any non-empty password (no length or complexity policy)."""
    if not isinstance(password, str) or password == "":
        raise AdminAuthError("Password is required")
    return password


def hash_password(password: str) -> str:
    return _PASSWORD_HASHER.hash(validate_password(password))


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _PASSWORD_HASHER.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


async def has_admin_account(db: Database) -> bool:
    count = await db.fetch_value("SELECT COUNT(*) FROM admin_accounts")
    return int(count or 0) > 0


async def get_admin_row(db: Database) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM admin_accounts LIMIT 1")


async def get_admin_by_username(db: Database, username: str) -> dict[str, Any] | None:
    normalized = normalize_username(username)
    if not normalized:
        return None
    return await db.fetch_one(
        "SELECT * FROM admin_accounts WHERE username = ?",
        (normalized,),
    )


async def create_admin_account(db: Database, *, username: str, password: str) -> dict[str, Any]:
    """Insert the singleton admin. Caller must ensure none exists yet."""
    clean_username = validate_username(username)
    password_hash = hash_password(password)
    now = utc_now_iso()
    admin_id = new_id()
    await db.execute(
        """
        INSERT INTO admin_accounts (id, username, password_hash, created_at, updated_at, singleton)
        VALUES (?, ?, ?, ?, ?, 1)
        """,
        (admin_id, clean_username, password_hash, now, now),
    )
    row = await db.fetch_one("SELECT * FROM admin_accounts WHERE id = ?", (admin_id,))
    assert row is not None
    return dict(row)


async def verify_admin_credentials(
    db: Database,
    *,
    username: str,
    password: str,
) -> dict[str, Any] | None:
    row = await get_admin_by_username(db, username)
    if row is None:
        return None
    if not verify_password(str(row["password_hash"]), password):
        return None
    return dict(row)


async def update_admin_password(db: Database, *, new_password: str) -> bool:
    """Replace the singleton admin password. Returns False if no admin exists."""
    row = await get_admin_row(db)
    if row is None:
        return False
    password_hash = hash_password(new_password)
    now = utc_now_iso()
    updated = await db.execute(
        "UPDATE admin_accounts SET password_hash = ?, updated_at = ? WHERE id = ?",
        (password_hash, now, row["id"]),
    )
    return updated == 1
