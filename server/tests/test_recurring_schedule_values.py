"""Pure recurring write clock normalization."""

from datetime import datetime

from server.services.recurring_schedule_values import manual_anchor, manual_end_anchor


def test_manual_anchors_roll_overnight_end_to_next_day() -> None:
    now = datetime(2026, 8, 4, 12, 0)
    start = manual_anchor("23:30", is_all_day=False, now=now)
    assert start == "2026-08-04T23:30:00"
    assert manual_end_anchor(start, "01:00", is_all_day=False) == "2026-08-05T01:00:00"


def test_all_day_anchor_uses_exclusive_next_day_end() -> None:
    start = manual_anchor(None, is_all_day=True, now=datetime(2026, 8, 4, 12, 0))
    assert start == "2026-08-04"
    assert manual_end_anchor(start, None, is_all_day=True) == "2026-08-05"
