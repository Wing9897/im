"""In-process per-client limits so the IM proxy cannot hammer IntelligenceCalendar.

Keep these numbers in sync with IntelligenceCalendar **compiled defaults**
(``app/config.py`` ``RATE_LIMIT_*`` / ``gateway.example.json``). IC runtime
reads ``gateway.json``; this proxy does not load that file.

- search: 5 / 10s / client
- login (IC auth login/refresh): 5 / 60s / client
- subscribe / unsubscribe: 5 / 10s / client
- events GET: 30 / 60s / client

Calendar PUT/PATCH write spacing stays on IC (``minWriteIntervalSeconds``),
not this sliding window. IM-only families (publish, catalog, publishList) keep
the previous 5/10s proxy budget so the renderer cannot stampede IC writes.
"""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import Request

from server.errors import RATE_LIMITED, http_error

# Synced with IntelligenceCalendar ``app/defaults.py`` ``GATEWAY_DEFAULTS["rateLimit"]``
# (drift-tested in ``test_contract_calendar_share_ic``). IM's ``public_events`` family
# fronts IC's ``GET /me/subscriptions/events`` → IC key ``subscriptionEvents``.
SEARCH_LIMIT = 5
SEARCH_WINDOW_SECONDS = 10.0
AUTH_LIMIT = 5
AUTH_WINDOW_SECONDS = 60.0
SUBSCRIBE_LIMIT = 5
SUBSCRIBE_WINDOW_SECONDS = 10.0
PUBLIC_EVENTS_LIMIT = 60
PUBLIC_EVENTS_WINDOW_SECONDS = 60.0

#: IM-only proxy families (not on the IC public table).
PROXY_LIMIT = 5
PROXY_WINDOW_SECONDS = 10.0


@dataclass(frozen=True)
class RateLimitRule:
    family: str
    limit: int
    window_seconds: float


SEARCH_RULE = RateLimitRule("search", SEARCH_LIMIT, SEARCH_WINDOW_SECONDS)
AUTH_RULE = RateLimitRule("auth", AUTH_LIMIT, AUTH_WINDOW_SECONDS)
SUBSCRIBE_RULE = RateLimitRule("subscribe", SUBSCRIBE_LIMIT, SUBSCRIBE_WINDOW_SECONDS)
UNSUBSCRIBE_RULE = RateLimitRule("unsubscribe", SUBSCRIBE_LIMIT, SUBSCRIBE_WINDOW_SECONDS)
PUBLIC_EVENTS_RULE = RateLimitRule("public_events", PUBLIC_EVENTS_LIMIT, PUBLIC_EVENTS_WINDOW_SECONDS)
PUBLISH_RULE = RateLimitRule("publish", PROXY_LIMIT, PROXY_WINDOW_SECONDS)
PUBLISH_LIST_RULE = RateLimitRule("publishList", PROXY_LIMIT, PROXY_WINDOW_SECONDS)
CATALOG_RULE = RateLimitRule("catalog", PROXY_LIMIT, PROXY_WINDOW_SECONDS)

_RULES: dict[str, RateLimitRule] = {
    rule.family: rule
    for rule in (
        SEARCH_RULE,
        AUTH_RULE,
        SUBSCRIBE_RULE,
        UNSUBSCRIBE_RULE,
        PUBLIC_EVENTS_RULE,
        PUBLISH_RULE,
        PUBLISH_LIST_RULE,
        CATALOG_RULE,
    )
}

_buckets: dict[str, deque[float]] = defaultdict(deque)
_last_cleanup = 0.0


def reset_calendar_share_rate_limit_for_tests() -> None:
    """Clear sliding windows between unit tests."""
    global _last_cleanup
    _buckets.clear()
    _last_cleanup = 0.0


def _client_key(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    authorization = request.headers.get("authorization") or ""
    if not authorization:
        return f"ip:{host}"
    digest = hashlib.sha256(authorization.encode("utf-8")).hexdigest()[:16]
    return f"ip:{host}:token:{digest}"


def _rule_for(family: str) -> RateLimitRule:
    return _RULES.get(family) or RateLimitRule(family, PROXY_LIMIT, PROXY_WINDOW_SECONDS)


def enforce_calendar_share_rate_limit(request: Request, family: str) -> None:
    """Raise 429 when this client has used `family` too often in the window."""
    global _last_cleanup
    rule = _rule_for(family)
    now = time.monotonic()
    cutoff = now - rule.window_seconds
    if now - _last_cleanup >= 10.0:
        stale = [key for key, bucket in _buckets.items() if not bucket or bucket[-1] <= cutoff]
        for key in stale:
            _buckets.pop(key, None)
        _last_cleanup = now
    key = f"{_client_key(request)}:{rule.family}"
    bucket = _buckets[key]
    while bucket and bucket[0] <= cutoff:
        bucket.popleft()
    if len(bucket) >= rule.limit:
        raise http_error(
            429,
            "Too many calendar-share requests. Please wait a moment.",
            error_code=RATE_LIMITED,
        )
    bucket.append(now)
