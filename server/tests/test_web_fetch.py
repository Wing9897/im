"""Constrained ``web.fetch`` page reader."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from server.agent.tools_registry import build_tool_schemas, execute_tool
from server.outbound import OutboundUrlError
from server.web_search.page_fetch import (
    MAX_CHARS,
    MAX_FETCHES_PER_TURN,
    OMITTED_MARKER,
    apply_text_cap,
    extract_readable_text,
    fetch_public_page,
    tool_fetch_page,
)


def test_extract_readable_text_strips_chrome_and_keeps_main() -> None:
    html = """
    <html><head><title>Example Title</title>
    <script>alert('x')</script><style>body{color:red}</style></head>
    <body>
      <nav>Home About</nav>
      <main>
        <h1>Headline</h1>
        <p>Useful paragraph with facts.</p>
      </main>
      <footer>Copyright</footer>
    </body></html>
    """
    title, text = extract_readable_text(html)
    assert title == "Example Title"
    assert "Headline" in text
    assert "Useful paragraph with facts." in text
    assert "alert" not in text
    assert "Home About" not in text
    assert "Copyright" not in text
    assert "<" not in text


def test_extract_readable_text_falls_back_when_main_is_too_short() -> None:
    html = """
    <html><head><title>Short main</title></head>
    <body>
      <main>Hi</main>
      <p>The real article paragraph lives outside main and must still be kept for quotes.</p>
    </body></html>
    """
    title, text = extract_readable_text(html)
    assert title == "Short main"
    assert "real article paragraph" in text
    assert "Hi" in text


def test_apply_text_cap_marks_omitted_tail() -> None:
    long_text = "a" * (MAX_CHARS + 50)
    capped, truncated = apply_text_cap(long_text)
    assert truncated is True
    assert OMITTED_MARKER in capped
    assert capped.startswith("a" * MAX_CHARS)
    short, not_truncated = apply_text_cap("hello")
    assert not_truncated is False
    assert short == "hello"


async def test_fetch_public_page_blocks_private_hosts() -> None:
    result = await fetch_public_page("http://127.0.0.1/admin")
    assert result["error"].startswith("blocked URL:")
    assert result["text"] == ""

    result = await fetch_public_page("http://169.254.169.254/latest/meta-data")
    assert result["error"].startswith("blocked URL:")

    result = await fetch_public_page("file:///etc/passwd")
    assert result["error"].startswith("blocked URL:")


async def test_fetch_public_page_extracts_mocked_html() -> None:
    html = b"""<!doctype html><html><head><title>News</title></head>
    <body><article><p>Quote: 42 tonnes.</p></article></body></html>"""

    class _Resp:
        status = 200
        url = "https://example.com/news"
        headers = {"Content-Type": "text/html; charset=utf-8"}
        content = type("C", (), {"read": staticmethod(AsyncMock(return_value=html))})()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

    class _Session:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def get(self, url, headers=None, allow_redirects=None):
            assert url == "https://example.com/news"
            assert allow_redirects is False
            return _Resp()

    with (
        patch("server.web_search.page_fetch.aiohttp.ClientSession", _Session),
        patch("server.web_search.page_fetch.validate_outbound_url", AsyncMock()),
    ):
        result = await fetch_public_page("https://example.com/news")

    assert "error" not in result
    assert result["title"] == "News"
    assert "42 tonnes" in result["text"]
    assert result["truncated"] is False


async def test_fetch_public_page_rejects_non_html() -> None:
    class _Resp:
        status = 200
        url = "https://example.com/data.json"
        headers = {"Content-Type": "application/json"}
        content = type("C", (), {"read": staticmethod(AsyncMock(return_value=b'{"a":1}'))})()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

    class _Session:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def get(self, url, headers=None, allow_redirects=None):
            return _Resp()

    with (
        patch("server.web_search.page_fetch.aiohttp.ClientSession", _Session),
        patch("server.web_search.page_fetch.validate_outbound_url", AsyncMock()),
    ):
        result = await fetch_public_page("https://example.com/data.json")

    assert result["error"].startswith("non-HTML content type:")


async def test_tool_fetch_page_disabled_and_turn_cap() -> None:
    disabled = await tool_fetch_page("https://example.com", enabled=False)
    assert disabled["error"] == "web fetch is disabled"

    ctx: dict = {"web_fetch_count": MAX_FETCHES_PER_TURN}
    capped = await tool_fetch_page("https://example.com", enabled=True, context=ctx)
    assert "limit reached" in capped["error"]


async def test_tool_fetch_page_increments_only_on_success() -> None:
    ctx: dict = {"web_fetch_count": 0}
    failed = {"error": "page fetch failed: HTTP 503", "text": "", "title": "", "truncated": False, "url": "https://example.com"}
    with patch("server.web_search.page_fetch.fetch_public_page", AsyncMock(return_value=failed)):
        await tool_fetch_page("https://example.com", enabled=True, context=ctx)
    assert ctx["web_fetch_count"] == 0

    ok = {
        "url": "https://example.com",
        "title": "Ok",
        "text": "Hello",
        "truncated": False,
        "chars": 5,
    }
    with patch("server.web_search.page_fetch.fetch_public_page", AsyncMock(return_value=ok)):
        await tool_fetch_page("https://example.com", enabled=True, context=ctx)
    assert ctx["web_fetch_count"] == 1


async def test_fetch_public_page_reports_http_error() -> None:
    class _Resp:
        status = 403
        url = "https://example.com/secret"
        headers = {"Content-Type": "text/html"}
        content = type("C", (), {"read": staticmethod(AsyncMock(return_value=b"nope"))})()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

    class _Session:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def get(self, url, headers=None, allow_redirects=None):
            return _Resp()

    with (
        patch("server.web_search.page_fetch.aiohttp.ClientSession", _Session),
        patch("server.web_search.page_fetch.validate_outbound_url", AsyncMock()),
    ):
        result = await fetch_public_page("https://example.com/secret")
    assert result["error"] == "page fetch failed: HTTP 403"
    assert result["text"] == ""


async def test_fetch_redirect_revalidates_ssrf() -> None:
    class _Redirect:
        status = 302
        url = "https://example.com"
        headers = {"Location": "http://127.0.0.1/admin"}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

    class _Session:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        def get(self, url, headers=None, allow_redirects=None):
            return _Redirect()

    async def _validate(url: str) -> None:
        if "127.0.0.1" in url:
            raise OutboundUrlError("Outbound URL resolves to a non-public address: 127.0.0.1")

    with (
        patch("server.web_search.page_fetch.aiohttp.ClientSession", _Session),
        patch("server.web_search.page_fetch.validate_outbound_url", _validate),
    ):
        result = await fetch_public_page("https://example.com")
    assert result["error"].startswith("blocked URL:")


async def test_execute_web_fetch_requires_tool_search_enabled(app) -> None:
    result = await execute_tool(
        app.state.db,
        "web.fetch",
        {"url": "https://example.com"},
        context={"web_search_enabled": False},
    )
    assert result["error"] == "web fetch is disabled"

    names = {s["name"] for s in build_tool_schemas(web_search_enabled=False)}
    assert "web.fetch" not in names
    names_on = {s["name"] for s in build_tool_schemas(web_search_enabled=True)}
    assert "web.fetch" in names_on


async def test_execute_web_fetch_success_increments_turn_count(app) -> None:
    mock_result = {
        "url": "https://example.com/page",
        "title": "Page",
        "text": "Hello",
        "truncated": False,
        "chars": 5,
    }
    context: dict = {"web_search_enabled": True}
    with patch("server.agent.tools_web_search.tool_fetch_page", AsyncMock(return_value=mock_result)) as mocked:
        result = await execute_tool(
            app.state.db,
            "web.fetch",
            {"url": "https://example.com/page"},
            context=context,
        )
    assert result["title"] == "Page"
    mocked.assert_awaited_once()
    assert mocked.await_args is not None
    assert mocked.await_args.kwargs["enabled"] is True


def test_outbound_error_shape_is_human_readable() -> None:
    err = OutboundUrlError("Outbound URL resolves to a non-public address: 10.0.0.1")
    assert "non-public" in str(err)
