"""Single source of truth for monitor／agent message-query time windows.

Extends ``analysis_tasks.analysis_time_range`` with ``12h``／``24h``. Those two
tokens are legal for message filters only — they must **not** be written to
``analysis_tasks.analysis_time_range`` (DB CHECK rejects them; use ``1d``／``48h``).

FE mirror: ``web/src/domain/messages/messageTimeRange.ts`` (drift-tested).
"""

from __future__ import annotations

from typing import Final, Literal

from server.domain.analysis_time_ranges import ALL_ANALYSIS_TIME_RANGES, AnalysisTimeRange

MESSAGE_ONLY_TIME_RANGE_12H: Final = "12h"
MESSAGE_ONLY_TIME_RANGE_24H: Final = "24h"

MessageOnlyTimeRange = Literal["12h", "24h"]
MessageTimeRange = AnalysisTimeRange | MessageOnlyTimeRange

ALL_MESSAGE_ONLY_TIME_RANGES: Final[tuple[MessageOnlyTimeRange, ...]] = (
    MESSAGE_ONLY_TIME_RANGE_12H,
    MESSAGE_ONLY_TIME_RANGE_24H,
)

ALL_MESSAGE_TIME_RANGES: Final[tuple[MessageTimeRange, ...]] = (
    *ALL_ANALYSIS_TIME_RANGES,
    *ALL_MESSAGE_ONLY_TIME_RANGES,
)

ALLOWED_MESSAGE_TIME_RANGES: Final[frozenset[str]] = frozenset(ALL_MESSAGE_TIME_RANGES)

#: Offset / ``today`` tokens that ``time_range_condition`` can filter on (not ``all``).
BOUNDED_MESSAGE_TIME_RANGES: Final[frozenset[str]] = frozenset(
    value for value in ALL_MESSAGE_TIME_RANGES if value != "all"
)
