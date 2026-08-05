from pathlib import Path

import pytest

from scripts import bump_version, desktop_verify


def test_bump_version_handles_release_and_numbered_prerelease() -> None:
    assert bump_version.bump("1.2.3") == "1.2.4"
    assert bump_version.bump("1.2.3-beta.9") == "1.2.3-beta.10"
    with pytest.raises(ValueError, match="Cannot bump"):
        bump_version.bump("1.2")


def test_bump_version_uses_file_unchanged_for_first_tag(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    version_file = tmp_path / "VERSION"
    version_file.write_text("2.0.0\n", encoding="utf-8")
    monkeypatch.setattr(bump_version, "VERSION_FILE", version_file)
    monkeypatch.setattr(bump_version, "latest_tag_version", lambda: None)

    assert bump_version.resolve_next(from_tags=True) == (
        "2.0.0",
        "2.0.0",
        "file-first",
    )


def test_desktop_verify_fast_checks_use_the_configured_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    web_dist = tmp_path / "web" / "dist"
    desktop_dist = tmp_path / "desktop" / "dist"
    server_dir = tmp_path / "server"
    web_dist.mkdir(parents=True)
    desktop_dist.mkdir(parents=True)
    server_dir.mkdir()
    (web_dist / "index.html").write_text("<div id='root'></div>", encoding="utf-8")
    (desktop_dist / "main.js").write_text("", encoding="utf-8")

    monkeypatch.setattr(desktop_verify, "ROOT", tmp_path)
    monkeypatch.setattr(desktop_verify, "WEB_DIST", web_dist)
    monkeypatch.setattr(desktop_verify, "DESKTOP_DIST", desktop_dist)
    monkeypatch.setattr(desktop_verify, "SERVER_DIR", server_dir)

    assert all(ok for _, ok, _ in desktop_verify.check_fast_paths())


def test_desktop_verify_full_requires_windows_release_artifacts(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime_dir = tmp_path / "desktop" / "server-runtime" / "intelligence-monitor-server"
    release_dir = tmp_path / "desktop" / "release"
    packaged_dir = release_dir / "win-unpacked" / "resources" / "server-runtime" / "intelligence-monitor-server"
    packaged_dir.mkdir(parents=True)
    (runtime_dir / "_internal").mkdir(parents=True)
    (runtime_dir / "intelligence-monitor-server.exe").write_text("", encoding="utf-8")
    (runtime_dir / "_internal" / "VERSION").write_text("1.0.0\n", encoding="utf-8")
    (packaged_dir / "intelligence-monitor-server.exe").write_text("", encoding="utf-8")
    (release_dir / "Intelligence Monitor Setup 1.0.0.exe").write_text("", encoding="utf-8")

    monkeypatch.setattr(desktop_verify, "SERVER_RUNTIME_DIR", runtime_dir)
    monkeypatch.setattr(desktop_verify, "RELEASE_DIR", release_dir)
    monkeypatch.setattr(desktop_verify.sys, "platform", "win32")

    assert all(ok for _, ok, _ in desktop_verify.check_release_paths())
