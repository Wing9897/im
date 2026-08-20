"""Constrained public-page fetch for assistant / agent ``web.fetch``.

Search stays in ``providers.py``. This module only reads 1–2 HTML pages when
snippets are not enough. It reuses ``validate_outbound_url`` (HTTP/HTTPS, no
loopback / private / link-local / unique-local / metadata).
"""

from __future__ import annotations

import logging
import re
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin

import aiohttp

from server.outbound import OutboundUrlError, validate_outbound_url

logger = logging.getLogger(__name__)

MAX_FETCHES_PER_TURN = 2
MAX_CHARS = 12_000
MAX_DOWNLOAD_BYTES = 512 * 1024
REQUEST_TIMEOUT_S = 12
MAX_REDIRECTS = 3
OMITTED_MARKER = "\n\n[omitted: remaining page text truncated]"

_HTML_TYPES = frozenset({"text/html", "application/xhtml+xml"})
_SKIP_TAGS = frozenset(
    {
        "script",
        "style",
        "noscript",
        "iframe",
        "svg",
        "canvas",
        "template",
        "nav",
        "footer",
        "header",
        "aside",
        "form",
        "button",
    }
)
_BLOCK_TAGS = frozenset(
    {
        "p",
        "div",
        "section",
        "article",
        "main",
        "li",
        "ul",
        "ol",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "tr",
        "br",
        "hr",
        "blockquote",
        "pre",
        "table",
    }
)
_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
}
_CHARSET_RE = re.compile(r"charset\s*=\s*['\"]?([^\s;'\"]+)", re.IGNORECASE)
_WS_RE = re.compile(r"[ \t]+")
_BLANK_RE = re.compile(r"\n{3,}")


class _ReadableTextParser(HTMLParser):
    """Strip chrome / scripts and keep readable body text (stdlib only)."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._in_title = False
        self._in_main = 0
        self.title_parts: list[str] = []
        self.body_parts: list[str] = []
        self.main_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        name = tag.lower()
        if name == "title":
            self._in_title = True
        if name in _SKIP_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if name in {"article", "main"}:
            self._in_main += 1
        if name in _BLOCK_TAGS:
            self._emit("\n")

    def handle_endtag(self, tag: str) -> None:
        name = tag.lower()
        if name == "title":
            self._in_title = False
        if name in _SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if name in {"article", "main"} and self._in_main:
            self._in_main -= 1
        if name in _BLOCK_TAGS:
            self._emit("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        text = _WS_RE.sub(" ", data).strip()
        if not text:
            return
        if self._in_title:
            self.title_parts.append(text)
            return
        self._emit(text)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        # Void / self-closing tags must not bump skip depth (no matching end tag).
        name = tag.lower()
        if name in _SKIP_TAGS:
            return
        if self._skip_depth:
            return
        if name in _BLOCK_TAGS:
            self._emit("\n")

    def _emit(self, piece: str) -> None:
        # Always keep a full-body stream so short <main>/<article> can fall back
        # without dropping the only readable paragraph.
        self.body_parts.append(piece)
        if self._in_main:
            self.main_parts.append(piece)


def extract_readable_text(html: str) -> tuple[str, str]:
    """Return ``(title, readable_text)`` from HTML; never returns raw markup."""
    parser = _ReadableTextParser()
    try:
        parser.feed(html or "")
        parser.close()
    except Exception:
        logger.warning("HTML parse failed; returning empty readable text", exc_info=True)
        return "", ""
    title = _WS_RE.sub(" ", " ".join(parser.title_parts)).strip()
    main = _normalize_extracted("".join(parser.main_parts))
    body = _normalize_extracted("".join(parser.body_parts))
    text = main if len(main) >= 80 else body
    return title[:300], text


def _normalize_extracted(raw: str) -> str:
    lines = [_WS_RE.sub(" ", line).strip() for line in raw.splitlines()]
    return _BLANK_RE.sub("\n\n", "\n".join(line for line in lines if line)).strip()


def apply_text_cap(text: str, *, max_chars: int = MAX_CHARS) -> tuple[str, bool]:
    cleaned = (text or "").strip()
    if len(cleaned) <= max_chars:
        return cleaned, False
    return cleaned[:max_chars].rstrip() + OMITTED_MARKER, True


def _content_type(headers: Any) -> str:
    raw = ""
    try:
        raw = str(headers.get("Content-Type") or "")
    except Exception:
        raw = ""
    return raw.split(";", 1)[0].strip().lower()


def _charset(headers: Any) -> str:
    raw = ""
    try:
        raw = str(headers.get("Content-Type") or "")
    except Exception:
        raw = ""
    match = _CHARSET_RE.search(raw)
    if not match:
        return "utf-8"
    encoding = match.group(1).strip()
    return encoding or "utf-8"


def _is_html_type(content_type: str) -> bool:
    if not content_type:
        return True
    return content_type in _HTML_TYPES


def _error(message: str, *, url: str = "") -> dict[str, Any]:
    payload: dict[str, Any] = {"error": message, "text": "", "title": "", "truncated": False}
    if url:
        payload["url"] = url
    return payload


async def fetch_public_page(url: str) -> dict[str, Any]:
    """GET a public HTTP(S) HTML page and return readable text (capped).

    Path: SSRF validate every hop → size cap → HTML extract (short ``<main>``
    falls back to body) → char cap + truncation marker.
    """
    target = (url or "").strip()
    if not target:
        return _error("url is required")
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT_S)
    current = target
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            for _hop in range(MAX_REDIRECTS + 1):
                await validate_outbound_url(current)
                async with session.get(
                    current,
                    headers=_REQUEST_HEADERS,
                    allow_redirects=False,
                ) as resp:
                    if resp.status in {301, 302, 303, 307, 308}:
                        location = str(resp.headers.get("Location") or "").strip()
                        if not location:
                            return _error("redirect without Location", url=current)
                        current = urljoin(current, location)
                        continue
                    if resp.status >= 400:
                        return _error(f"page fetch failed: HTTP {resp.status}", url=str(resp.url) or current)
                    content_type = _content_type(resp.headers)
                    if not _is_html_type(content_type):
                        final = str(resp.url) or current
                        return _error(
                            f"non-HTML content type: {content_type or 'unknown'}",
                            url=final,
                        )
                    declared = resp.headers.get("Content-Length")
                    if declared is not None:
                        try:
                            if int(declared) > MAX_DOWNLOAD_BYTES:
                                return _error("page too large", url=str(resp.url) or current)
                        except (TypeError, ValueError):
                            pass
                    raw = await resp.content.read(MAX_DOWNLOAD_BYTES + 1)
                    if len(raw) > MAX_DOWNLOAD_BYTES:
                        return _error("page too large", url=str(resp.url) or current)
                    encoding = _charset(resp.headers)
                    try:
                        html = raw.decode(encoding, errors="replace")
                    except LookupError:
                        html = raw.decode("utf-8", errors="replace")
                    final_url = str(resp.url) or current
                    title, text = extract_readable_text(html)
                    capped, truncated = apply_text_cap(text)
                    if not capped:
                        return _error("no readable text on page", url=final_url)
                    return {
                        "url": final_url,
                        "title": title,
                        "text": capped,
                        "truncated": truncated,
                        "chars": len(capped),
                    }
            return _error("too many redirects", url=current)
    except OutboundUrlError as exc:
        return _error(f"blocked URL: {exc}", url=target)
    except TimeoutError:
        return _error("page fetch timed out", url=target)
    except (aiohttp.ClientError, OSError, ValueError) as exc:
        logger.warning("Page fetch failed: %s", exc)
        return _error(f"page fetch failed: {exc}", url=target)


async def tool_fetch_page(
    url: str,
    *,
    enabled: bool = True,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Assistant-facing fetch with master switch + per-turn cap."""
    if not enabled:
        return _error("web fetch is disabled")
    ctx = context if context is not None else {}
    used = int(ctx.get("web_fetch_count") or 0)
    if used >= MAX_FETCHES_PER_TURN:
        return _error(f"web.fetch limit reached ({MAX_FETCHES_PER_TURN} per turn)")
    result = await fetch_public_page(url)
    if not result.get("error"):
        ctx["web_fetch_count"] = used + 1
    return result
