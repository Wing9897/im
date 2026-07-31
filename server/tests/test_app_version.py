from pathlib import Path

import server.version as version_mod


def test_read_app_version_matches_version_file() -> None:
    expected = Path("VERSION").read_text(encoding="utf-8").strip()
    assert version_mod.read_app_version() == expected
    assert version_mod.__version__ == expected


def test_version_file_uses_meipass_when_frozen(tmp_path: Path, monkeypatch) -> None:
    bundled = tmp_path / "VERSION"
    bundled.write_text("9.9.9-test\n", encoding="utf-8")
    monkeypatch.setattr(version_mod.sys, "frozen", True, raising=False)
    monkeypatch.setattr(version_mod.sys, "_MEIPASS", str(tmp_path), raising=False)
    assert version_mod._version_file() == bundled
    assert version_mod.read_app_version() == "9.9.9-test"
