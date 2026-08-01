"""SQLite busy helper tests."""

from server.db.sqlite_busy import is_sqlite_busy


def test_is_sqlite_busy_matches_locked_and_busy_messages() -> None:
    assert is_sqlite_busy(RuntimeError("database is locked"))
    assert is_sqlite_busy(RuntimeError("database is busy"))
    assert not is_sqlite_busy(RuntimeError("connection refused"))
