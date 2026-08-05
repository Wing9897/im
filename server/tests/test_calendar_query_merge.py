"""Pure calendar source-policy and merge behavior."""

from server.calendar.query_merge import merge_calendar_items, source_policy


def test_source_policy_keeps_ownership_and_task_filters_distinct() -> None:
    assert source_policy(task_id=None, workset_id=None).include_items
    assert not source_policy(task_id="task-1", workset_id=None).include_items
    system = source_policy(task_id=None, workset_id="__user__")
    assert not system.include_analysis_and_recurrence
    assert system.include_items


def test_merge_calendar_items_filters_sorts_and_paginates_across_sources() -> None:
    analysis = [
        {"id": "b", "title": "match later", "startTime": "2026-08-02T00:00:00Z"},
    ]
    recurring = [
        {"id": "a", "title": "match first", "startTime": "2026-08-01T00:00:00Z"},
        {"id": "c", "title": "ignored", "startTime": "2026-07-31T00:00:00Z"},
    ]

    page, cursor = merge_calendar_items(
        (analysis, recurring),
        search="match",
        limit=1,
        offset=0,
        ascending=True,
    )

    assert [item["id"] for item in page] == ["a"]
    assert cursor == "1"
