from server.version import __version__, read_app_version


def test_read_app_version_matches_version_file() -> None:
    assert read_app_version() == "0.1.0-beta.4"
    assert __version__ == "0.1.0-beta.4"
