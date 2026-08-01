"""Tests for connection.json local password-reset arming."""

from __future__ import annotations

from pathlib import Path

import pytest

from server import connection_file as cf
from server.constants import DATA_DIR_ENV


@pytest.fixture(autouse=True)
def _data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv(DATA_DIR_ENV, str(tmp_path))
    return tmp_path


def test_unarmed_when_file_missing() -> None:
    assert cf.is_local_password_reset_armed() is False


def test_armed_only_when_explicit_true(tmp_path: Path) -> None:
    path = tmp_path / cf.CONNECTION_FILENAME
    path.write_text('{"mode":"host","resetPasswordForLocal":false}\n', encoding="utf-8")
    assert cf.is_local_password_reset_armed() is False
    path.write_text('{"mode":"host","resetPasswordForLocal":true}\n', encoding="utf-8")
    assert cf.is_local_password_reset_armed() is True


def test_disarm_clears_flag_and_keeps_mode(tmp_path: Path) -> None:
    path = tmp_path / cf.CONNECTION_FILENAME
    path.write_text(
        '{"mode":"client","serverUrl":"http://192.168.1.10:18820","resetPasswordForLocal":true}\n',
        encoding="utf-8",
    )
    assert cf.disarm_local_password_reset() is True
    assert cf.is_local_password_reset_armed() is False
    data = path.read_text(encoding="utf-8")
    assert '"resetPasswordForLocal": false' in data
    assert '"mode": "client"' in data
    assert "192.168.1.10" in data
