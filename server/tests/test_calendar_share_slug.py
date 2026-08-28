"""Calendar-share slug write rule vs builtin workset id."""

from typing import Any, cast

import pytest
from fastapi import HTTPException

from server.calendar_share.constants import DEFAULT_GENERAL_SLUG, INVALID_SLUG_MESSAGE, SLUG_MAX_LEN
from server.calendar_share.store import coerce_publish_slug, default_publish_slug, normalize_slug
from server.errors import INVALID_CALENDAR_SLUG
from server.worksets_const import SYSTEM_WORKSET_ID


def test_default_publish_slug_maps_general_workset():
    assert default_publish_slug("一般", SYSTEM_WORKSET_ID) == DEFAULT_GENERAL_SLUG
    assert DEFAULT_GENERAL_SLUG == "general"
    assert coerce_publish_slug("__general__") == "general"


def test_default_publish_slug_sanitizes_other_ids():
    assert default_publish_slug("Ops", "ws-1") == "Ops"
    assert default_publish_slug("Team board", "ws-team") == "Team-board"
    assert default_publish_slug("專案", "_my-set_") == "my-set"
    assert default_publish_slug("...", "...") == "calendar"


def test_normalize_slug_rejects_invalid():
    for raw in ("", "   ", "foo bar", "a/b", "a" * (SLUG_MAX_LEN + 1), "_leading", SYSTEM_WORKSET_ID):
        with pytest.raises(HTTPException) as caught:
            normalize_slug(raw)
        assert caught.value.status_code == 422
        detail = cast(dict[str, Any], caught.value.detail)
        assert detail["error_code"] == INVALID_CALENDAR_SLUG
        assert detail["message"] == INVALID_SLUG_MESSAGE


def test_normalize_slug_accepts_write_valid_and_legacy_read():
    assert normalize_slug("general") == "general"
    assert normalize_slug("A_B") == "A_B"
    assert normalize_slug("foo-bar.baz") == "foo-bar.baz"
    assert normalize_slug(SYSTEM_WORKSET_ID, allow_legacy=True) == SYSTEM_WORKSET_ID
    with pytest.raises(HTTPException):
        normalize_slug(SYSTEM_WORKSET_ID)
