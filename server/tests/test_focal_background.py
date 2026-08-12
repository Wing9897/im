"""Focal / Bing daily background: locale mapping, archive parse, route."""

from __future__ import annotations

import json

import pytest

from server.services.focal_background import (
    _BING_FORMAT,
    _clear_cache_for_tests,
    _decode_archive_body,
    clamp_focal_idx,
    parse_bing_archive,
    parse_bing_archive_xml,
    resolve_bing_mkt,
)
from server.tests.contract_helpers import assert_keys

FOCAL_KEYS = ["imageUrl", "title", "copyright", "date", "locale", "source"]

_SAMPLE_JSON = {
    "images": [
        {
            "startdate": "20260812",
            "url": "/th?id=OHR.Example_ZH-HK1920x1080.jpg&rf=LaDigue_1920x1080.jpg",
            "title": "Example peak",
            "copyright": "Example peak (© Photographer)",
        }
    ]
}

_SAMPLE_XML = """<?xml version="1.0" encoding="utf-8" ?>
<images>
  <image>
    <startdate>20260812</startdate>
    <url>/th?id=OHR.Example_ZH-HK1920x1080.jpg&amp;rf=LaDigue_1920x1080.jpg</url>
    <urlBase>/th?id=OHR.Example_ZH-HK1920x1080</urlBase>
    <title>Example peak</title>
    <copyright>Example peak (© Photographer)</copyright>
  </image>
</images>
"""


@pytest.fixture(autouse=True)
def _clear_focal_cache():
    _clear_cache_for_tests()
    yield
    _clear_cache_for_tests()


def test_bing_format_is_js_not_json() -> None:
    """Bing returns XML for format=json; JSON requires format=js."""
    assert _BING_FORMAT == "js"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, 0),
        (0, 0),
        (3, 3),
        (7, 7),
        (8, 7),
        (-1, 0),
        ("2", 2),
        ("nope", 0),
    ],
)
def test_clamp_focal_idx(raw, expected) -> None:
    assert clamp_focal_idx(raw) == expected


@pytest.mark.parametrize(
    ("locale", "mkt"),
    [
        (None, "en-US"),
        ("", "en-US"),
        ("en", "en-US"),
        ("zh-Hans", "zh-CN"),
        ("zh-Hant", "zh-HK"),
        ("zh-TW", "zh-TW"),
        ("ja-JP", "ja-JP"),
        ("unknown", "en-US"),
    ],
)
def test_resolve_bing_mkt(locale: str | None, mkt: str) -> None:
    assert resolve_bing_mkt(locale) == mkt


def test_parse_bing_archive_builds_absolute_url() -> None:
    result = parse_bing_archive(_SAMPLE_JSON, mkt="zh-HK")
    assert result.imageUrl.startswith("https://www.bing.com/th?id=OHR.Example")
    assert result.title == "Example peak"
    assert result.copyright == "Example peak (© Photographer)"
    assert result.date == "20260812"
    assert result.locale == "zh-HK"
    assert result.source == "bing"


def test_parse_bing_archive_rejects_empty() -> None:
    with pytest.raises(ValueError):
        parse_bing_archive({"images": []}, mkt="en-US")


def test_parse_bing_archive_xml_builds_absolute_url() -> None:
    result = parse_bing_archive_xml(_SAMPLE_XML, mkt="zh-HK")
    assert result.imageUrl.startswith("https://www.bing.com/th?id=OHR.Example")
    assert "&amp;" not in result.imageUrl
    assert result.title == "Example peak"
    assert result.copyright == "Example peak (© Photographer)"
    assert result.date == "20260812"
    assert result.locale == "zh-HK"


def test_decode_archive_body_json_and_xml() -> None:
    from_json = _decode_archive_body(
        json.dumps(_SAMPLE_JSON),
        content_type="application/json; charset=utf-8",
        mkt="en-US",
    )
    from_xml = _decode_archive_body(
        _SAMPLE_XML,
        content_type="text/xml; charset=utf-8",
        mkt="en-US",
    )
    assert from_json.imageUrl == from_xml.imageUrl
    assert from_json.title == from_xml.title


async def test_focal_background_route_returns_metadata(client, monkeypatch) -> None:
    from server.api.schemas.responses.theme import FocalBackgroundResponse

    async def _fake(
        locale: str | None = None,
        idx: int | None = None,
    ) -> FocalBackgroundResponse:
        assert idx in (None, 0, 2)
        return FocalBackgroundResponse(
            imageUrl="https://www.bing.com/th?id=OHR.Fake",
            title="Fake",
            copyright="Fake (© Test)",
            date="20260812",
            locale="zh-HK",
            source="bing",
        )

    monkeypatch.setattr(
        "server.api.routes.theme.fetch_focal_background",
        _fake,
    )
    response = await client.get("/api/v1/theme/focal-background", params={"locale": "zh-Hant"})
    assert response.status_code == 200
    body = response.json()
    assert_keys(body, FOCAL_KEYS, "FocalBackgroundResponse")
    assert body["imageUrl"] == "https://www.bing.com/th?id=OHR.Fake"
    assert body["locale"] == "zh-HK"
    assert body["source"] == "bing"

    response_idx = await client.get(
        "/api/v1/theme/focal-background",
        params={"locale": "zh-Hant", "idx": 2},
    )
    assert response_idx.status_code == 200


async def test_focal_background_image_route_returns_bytes(client, monkeypatch) -> None:
    async def _fake_image(
        locale: str | None = None,
        idx: int | None = None,
    ) -> tuple[bytes, str]:
        assert locale in (None, "zh-Hant", "en")
        assert idx in (None, 0, 1)
        return b"\xff\xd8\xfffakejpeg", "image/jpeg"

    monkeypatch.setattr(
        "server.api.routes.theme.fetch_focal_background_image",
        _fake_image,
    )
    response = await client.get(
        "/api/v1/theme/focal-background/image",
        params={"locale": "zh-Hant", "idx": 1},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/jpeg")
    assert response.content.startswith(b"\xff\xd8\xff")


async def test_focal_background_route_rejects_idx_out_of_range(client) -> None:
    response = await client.get("/api/v1/theme/focal-background", params={"idx": 9})
    assert response.status_code == 422


async def test_focal_background_route_upstream_failure(client, monkeypatch) -> None:
    from server.errors import http_error

    async def _boom(locale: str | None = None, idx: int | None = None):
        raise http_error(
            502,
            "Focal background upstream unavailable",
            error_code="FOCAL_BACKGROUND_UNAVAILABLE",
            details={"source": "bing", "locale": "en-US"},
        )

    monkeypatch.setattr("server.api.routes.theme.fetch_focal_background", _boom)
    response = await client.get("/api/v1/theme/focal-background")
    assert response.status_code == 502
    body = response.json()
    assert body["error_code"] == "FOCAL_BACKGROUND_UNAVAILABLE"


async def test_fetch_focal_background_uses_cache(monkeypatch) -> None:
    from server.services import focal_background as mod

    calls = {"n": 0, "params": None, "headers": None}

    class _Resp:
        status = 200
        headers = {"Content-Type": "application/json; charset=utf-8"}

        async def text(self):
            return json.dumps(
                {
                    "images": [
                        {
                            "startdate": "20260812",
                            "url": "/th?id=OHR.Cached",
                            "title": "Cached",
                            "copyright": "Cached (© X)",
                        }
                    ]
                }
            )

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    class _Session:
        def __init__(self, *args, **kwargs):
            calls["headers"] = kwargs.get("headers")

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        def get(self, *args, **kwargs):
            calls["n"] += 1
            calls["params"] = kwargs.get("params")
            return _Resp()

    monkeypatch.setattr(mod.aiohttp, "ClientSession", _Session)
    first = await mod.fetch_focal_background("en")
    second = await mod.fetch_focal_background("en")
    assert first.imageUrl == second.imageUrl
    assert calls["n"] == 1
    assert calls["params"] == {"format": "js", "idx": "0", "n": "1", "mkt": "en-US"}
    assert calls["headers"] and "User-Agent" in calls["headers"]

    # Different idx is a separate cache slot.
    third = await mod.fetch_focal_background("en", idx=3)
    assert third.imageUrl == first.imageUrl
    assert calls["n"] == 2
    assert calls["params"] == {"format": "js", "idx": "3", "n": "1", "mkt": "en-US"}


async def test_fetch_focal_background_xml_fallback(monkeypatch) -> None:
    from server.services import focal_background as mod

    class _Resp:
        status = 200
        headers = {"Content-Type": "text/xml; charset=utf-8"}

        async def text(self):
            return _SAMPLE_XML

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    class _Session:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        def get(self, *args, **kwargs):
            return _Resp()

    monkeypatch.setattr(mod.aiohttp, "ClientSession", _Session)
    result = await mod.fetch_focal_background("zh-Hant")
    assert result.imageUrl.startswith("https://www.bing.com/th?id=OHR.Example")
    assert result.locale == "zh-HK"
