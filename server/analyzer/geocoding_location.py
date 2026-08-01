"""Location string normalize / disambiguate helpers for geocoding."""

from __future__ import annotations

import re
from typing import Any

UNKNOWN_LOCATION = "N/A"
#: Null-Island sentinel for global / online / unspecified places.
UNSPECIFIC_COORDINATES = (0.0, 0.0)
_LITERAL_COORDINATE_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$")
_UNKNOWN_LOCATION_TOKENS = {
    "",
    "0,0",
    "0.0,0.0",
    "n/a",
    "na",
    "unknown",
    "未知",
    "全球",
    "全世界",
    "世界",
    "網上",
    "网上",
    "線上",
    "线上",
    "網路",
    "网络",
    "網際網路",
    "互联网",
    "online",
    "internet",
    "global",
    "worldwide",
    "world",
    "web",
    "虛擬",
    "虚拟",
}

_LOCATION_FALLBACK_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"紐約|New York", re.IGNORECASE), "美國紐約"),
    (re.compile(r"華盛頓|Washington", re.IGNORECASE), "美國華盛頓"),
    (re.compile(r"布魯塞爾|Brussels", re.IGNORECASE), "比利時布魯塞爾"),
    (re.compile(r"日內瓦|Geneva", re.IGNORECASE), "瑞士日內瓦"),
    (re.compile(r"台北|臺北|Taipei", re.IGNORECASE), "台灣台北"),
    (re.compile(r"東京|Tokyo", re.IGNORECASE), "日本東京"),
    (re.compile(r"首爾|Seoul", re.IGNORECASE), "韓國首爾"),
    (re.compile(r"香港|Hong Kong", re.IGNORECASE), "香港"),
    (re.compile(r"新加坡|Singapore", re.IGNORECASE), "新加坡"),
    (re.compile(r"杜拜|迪拜|Dubai", re.IGNORECASE), "杜拜"),
    (re.compile(r"美國|美国|United States|\bUS\b|\bU\.S\.", re.IGNORECASE), "美國"),
    (re.compile(r"中國|中国|China", re.IGNORECASE), "中国"),
    (re.compile(r"日本|Japan", re.IGNORECASE), "日本"),
    (re.compile(r"韓國|韩国|South Korea", re.IGNORECASE), "韓國"),
    (re.compile(r"台灣|台湾|Taiwan", re.IGNORECASE), "台灣"),
    (re.compile(r"英國|英国|United Kingdom|\bUK\b", re.IGNORECASE), "英國"),
    (re.compile(r"歐洲|欧洲|Europe", re.IGNORECASE), "歐洲"),
    (re.compile(r"俄羅斯|俄罗斯|Russia", re.IGNORECASE), "俄羅斯"),
    (re.compile(r"印度|India", re.IGNORECASE), "印度"),
    (re.compile(r"澳洲|澳大利亞|Australia", re.IGNORECASE), "澳洲"),
]

# Short / ambiguous place names → rewrite when title/body context matches.
# Order matters: more specific context rules first.
_AMBIGUOUS_LOCATION_REWRITES: list[tuple[re.Pattern[str], re.Pattern[str], str]] = [
    (
        re.compile(r"^德[州洲]$"),
        re.compile(
            r"SpaceX|星艦|Starship|Texas|德州時間|德洲時間|Starbase|Boca\s*Chica|"
            r"馬斯克|马斯克|Musk|發射窗口|发射窗口",
            re.IGNORECASE,
        ),
        "美國德克薩斯州 Texas, USA",
    ),
    (
        re.compile(r"^德[州洲]$"),
        re.compile(r"山東|山东|德州市|平原|禹城|樂陵|乐陵", re.IGNORECASE),
        "中國山東省德州市",
    ),
    (
        re.compile(r"^華盛頓$|^Washington$", re.IGNORECASE),
        re.compile(r"白宮|White\s*House|\bD\.?C\.?\b|國會|Capitol|特區", re.IGNORECASE),
        "美國華盛頓特區 Washington, D.C., USA",
    ),
    (
        re.compile(r"^華盛頓$|^Washington$", re.IGNORECASE),
        re.compile(r"州|State|西雅圖|Seattle|塔科馬|Tacoma", re.IGNORECASE),
        "美國華盛頓州 Washington, USA",
    ),
]

_DETAILED_LOCATION_HINT = re.compile(
    r"美國|美国|中國|中国|日本|韓國|韩国|台灣|台湾|英國|英国|"
    r"USA|United\s+States|China|Japan|Texas|德克薩斯|山东省|山東省|,",
    re.IGNORECASE,
)


def _extract_fallback_location(title: str, content: str) -> str:
    text = f"{title} {content}"
    for pattern, location in _LOCATION_FALLBACK_RULES:
        if pattern.search(text):
            return location
    return ""


def _item_context_text(item: dict[str, Any]) -> str:
    """Title + body/content/summary for disambiguation (LLM uses body)."""
    parts: list[str] = []
    title = item.get("title")
    if title:
        parts.append(str(title))
    for key in ("body", "content", "summary"):
        value = item.get(key)
        if value:
            parts.append(str(value))
            break
    return " ".join(parts)


def _disambiguate_location(location: str, context: str) -> str | None:
    """Rewrite short ambiguous place names when context clearly selects one sense."""
    if not location or not context:
        return None
    for location_pattern, context_pattern, rewritten in _AMBIGUOUS_LOCATION_REWRITES:
        if location_pattern.search(location) and context_pattern.search(context):
            return rewritten
    return None


def _build_geocode_query(location: str, context: str) -> str:
    """Prefer a query detailed enough for Nominatim when location is a short name."""
    if _DETAILED_LOCATION_HINT.search(location):
        return location
    if not context:
        return location
    # Append a country/region hint from context when location alone is underspecified.
    for pattern, hint in _LOCATION_FALLBACK_RULES:
        if pattern.search(context) and hint not in location:
            return f"{location}, {hint}"
    return location


def _normalize_location_value(raw_location: Any) -> str:
    if raw_location is None:
        return ""
    return str(raw_location).strip()


def _is_unknown_location_token(location: str | None) -> bool:
    if location is None:
        return True
    return location.strip().lower() in _UNKNOWN_LOCATION_TOKENS


def _parse_literal_coordinates(location: str) -> tuple[float, float] | None:
    match = _LITERAL_COORDINATE_RE.match(location)
    if match is None:
        return None

    lat = float(match.group(1))
    lng = float(match.group(2))
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return lat, lng
    return None
