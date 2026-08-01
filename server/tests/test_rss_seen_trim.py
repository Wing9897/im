"""RSS adapter _seen_entries cap."""

from __future__ import annotations

from server.collector.rss import _SEEN_ENTRIES_MAX, RssAdapter


def test_seen_entries_trimmed_to_cap():
    adapter = RssAdapter.__new__(RssAdapter)
    adapter._seen_entries = set()

    for index in range(_SEEN_ENTRIES_MAX + 100):
        adapter._remember_entry(f"entry-{index}")

    assert len(adapter._seen_entries) == _SEEN_ENTRIES_MAX
