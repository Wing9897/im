"""Tests for unified data-root / Telegram sessions path resolution."""

from __future__ import annotations

from pathlib import Path

import pytest

from server import paths as paths_mod
from server.constants import DATA_DIR_ENV, SESSIONS_DIR_ENV


@pytest.fixture(autouse=True)
def _clear_path_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(DATA_DIR_ENV, raising=False)
    monkeypatch.delenv(SESSIONS_DIR_ENV, raising=False)


def test_data_dir_defaults_to_product_userdata(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root = tmp_path / "Intelligence Monitor"
    monkeypatch.setattr(paths_mod, "default_data_dir", lambda: root)
    assert paths_mod.data_dir() == root
    assert paths_mod.default_db_path() == root / "intelligence_monitor.db"
    assert paths_mod.default_secret_key_path() == root / "secret.key"
    assert paths_mod.sessions_dir() == root / "sessions"


def test_data_dir_respects_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root = tmp_path / "userData"
    monkeypatch.setenv(DATA_DIR_ENV, str(root))
    assert paths_mod.data_dir() == root
    assert paths_mod.sessions_dir() == root / "sessions"
    assert paths_mod.default_secret_key_path() == root / "secret.key"


def test_sessions_dir_env_override(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv(DATA_DIR_ENV, str(tmp_path / "data"))
    monkeypatch.setenv(SESSIONS_DIR_ENV, str(tmp_path / "custom-sessions"))
    assert paths_mod.sessions_dir() == tmp_path / "custom-sessions"


def test_clear_telegram_session_files_removes_active_and_legacy(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    data = tmp_path / "userData"
    legacy = tmp_path / "home" / ".intelligence-monitor" / "sessions"
    active = data / "sessions"
    active.mkdir(parents=True)
    legacy.mkdir(parents=True)
    (active / "new.session.txt").write_text("a", encoding="utf-8")
    (legacy / "old.session.txt").write_text("b", encoding="utf-8")
    (active / "stale.session").write_bytes(b"sqlite-leftover")
    (active / "notes.txt").write_text("keep", encoding="utf-8")

    monkeypatch.setenv(DATA_DIR_ENV, str(data))
    monkeypatch.setattr(paths_mod, "legacy_sessions_dir", lambda: legacy)

    assert paths_mod.clear_telegram_session_files() == 3
    assert not (active / "new.session.txt").exists()
    assert not (legacy / "old.session.txt").exists()
    assert not (active / "stale.session").exists()
    assert (active / "notes.txt").exists()


def test_clear_secret_key_and_connection_json(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    data = tmp_path / "userData"
    legacy = tmp_path / "legacy-home"
    data.mkdir()
    legacy.mkdir()
    (data / "secret.key").write_bytes(b"active-key")
    (legacy / "secret.key").write_bytes(b"legacy-key")
    (data / "connection.json").write_text("{}", encoding="utf-8")
    (legacy / "connection.json").write_text("{}", encoding="utf-8")

    monkeypatch.setenv(DATA_DIR_ENV, str(data))
    monkeypatch.setattr(paths_mod, "legacy_home_dir", lambda: legacy)

    assert paths_mod.clear_secret_key_files() == 2
    assert paths_mod.clear_connection_json_files() == 2
    assert not (data / "secret.key").exists()
    assert not (legacy / "secret.key").exists()
    assert not (data / "connection.json").exists()
    assert not (legacy / "connection.json").exists()


def test_ensure_sessions_dir_creates_without_copying(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    legacy = tmp_path / "home" / ".intelligence-monitor" / "sessions"
    data = tmp_path / "ElectronUserData"
    legacy.mkdir(parents=True)
    (legacy / "tg.session.txt").write_text("sess", encoding="utf-8")

    monkeypatch.setenv(DATA_DIR_ENV, str(data))
    monkeypatch.setattr(paths_mod, "legacy_sessions_dir", lambda: legacy)

    result = paths_mod.ensure_sessions_dir()
    assert result == data / "sessions"
    assert result.is_dir()
    assert not (result / "tg.session.txt").exists()
