"""Authenticated encryption for credentials stored by the local server."""

from __future__ import annotations

import base64
import ctypes
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from server.constants import SECRET_KEY_FILE_ENV
from server.paths import default_secret_key_path

_ENCRYPTED_PREFIX = "enc:v1:"

MASKED_SECRET = "********"
#: system_config secret keys only. Profile api_key / brave keys are column-encrypted.
SECRET_CONFIG_KEYS = frozenset(
    {
        "calendar_share_access_token",
        "calendar_share_refresh_token",
    }
)


class SecretProtectionError(RuntimeError):
    pass


class _DataBlob(ctypes.Structure):
    _fields_ = [
        ("cbData", ctypes.c_ulong),
        ("pbData", ctypes.POINTER(ctypes.c_ubyte)),
    ]


def _dpapi_transform(data: bytes, *, decrypt: bool) -> bytes:
    if os.name != "nt":
        raise SecretProtectionError("Windows DPAPI is unavailable")
    source_buffer = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
    source = _DataBlob(len(data), source_buffer)
    destination = _DataBlob()
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    function = crypt32.CryptUnprotectData if decrypt else crypt32.CryptProtectData
    description_arg: Any = None if decrypt else ctypes.c_wchar_p("IntelligenceMonitor")
    succeeded = function(
        ctypes.byref(source),
        description_arg,
        None,
        None,
        None,
        1,  # CRYPTPROTECT_UI_FORBIDDEN
        ctypes.byref(destination),
    )
    if not succeeded:
        raise SecretProtectionError(f"DPAPI operation failed with Windows error {ctypes.get_last_error()}")
    try:
        return ctypes.string_at(destination.pbData, destination.cbData)
    finally:
        kernel32.LocalFree(destination.pbData)


def _key_file_path() -> Path:
    configured = os.environ.get(SECRET_KEY_FILE_ENV)
    if configured:
        return Path(configured).expanduser()
    # Desktop / CLI share DATA_DIR → {userData}/secret.key (Electron userData when packaged)
    return default_secret_key_path()


def _encode_key_file(key: bytes) -> bytes:
    if os.name == "nt":
        return b"dpapi:" + base64.urlsafe_b64encode(_dpapi_transform(key, decrypt=False))
    return b"plain:" + key


def _decode_key_file(payload: bytes) -> bytes:
    if payload.startswith(b"dpapi:"):
        encrypted = base64.urlsafe_b64decode(payload[6:])
        return _dpapi_transform(encrypted, decrypt=True)
    if payload.startswith(b"plain:"):
        return payload[6:]
    raise SecretProtectionError("Unknown secret key file format")


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    path = _key_file_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        payload = path.read_bytes()
    except FileNotFoundError:
        key = Fernet.generate_key()
        try:
            with path.open("xb") as file:
                file.write(_encode_key_file(key))
            if os.name != "nt":
                path.chmod(0o600)
        except FileExistsError:
            payload = path.read_bytes()
        else:
            return Fernet(key)
    return Fernet(_decode_key_file(payload))


def wipe_secret_key_files() -> int:
    """Delete on-disk ``secret.key`` files and drop the in-process Fernet cache.

    Full reset must not reuse the previous encryption key.
    """
    _fernet.cache_clear()
    from server.paths import clear_secret_key_files

    return clear_secret_key_files(_key_file_path())


def protect_text(value: str) -> str:
    if not value or value.startswith(_ENCRYPTED_PREFIX):
        return value
    token = _fernet().encrypt(value.encode("utf-8")).decode("ascii")
    return _ENCRYPTED_PREFIX + token


def unprotect_text(value: Any) -> str:
    text = "" if value is None else str(value)
    if not text.startswith(_ENCRYPTED_PREFIX):
        return text
    try:
        return _fernet().decrypt(text[len(_ENCRYPTED_PREFIX) :].encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise SecretProtectionError("Stored secret cannot be decrypted for this OS user") from exc
