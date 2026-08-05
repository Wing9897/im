"""Unit tests for Telegram media metadata extraction."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock

from telethon.tl.types import DocumentAttributeAnimated

from server.collector.telegram_media import build_telegram_raw_data, extract_telegram_media
from server.wire.serializers import serialize_message


def _msg(**attrs: object) -> MagicMock:
    message = MagicMock()
    for key, value in attrs.items():
        setattr(message, key, value)
    return message


def test_extract_photo():
    media = extract_telegram_media(_msg(photo=object(), video=None, sticker=None, voice=None, document=None))
    assert media == {"kind": "photo", "mime": "image/jpeg"}


def test_extract_video():
    video = SimpleNamespace(mime_type="video/mp4")
    media = extract_telegram_media(_msg(photo=None, video=video, sticker=None, voice=None, document=None))
    assert media == {"kind": "video", "mime": "video/mp4"}


def test_extract_gif_document():
    doc = SimpleNamespace(mime_type="video/mp4", attributes=[DocumentAttributeAnimated()])
    media = extract_telegram_media(_msg(photo=None, video=None, sticker=None, voice=None, document=doc))
    assert media == {"kind": "gif", "mime": "video/mp4"}


def test_build_raw_data_json():
    raw = build_telegram_raw_data(_msg(photo=object(), video=None, sticker=None, voice=None, document=None))
    assert raw is not None
    assert json.loads(raw) == {"media": {"kind": "photo", "mime": "image/jpeg"}}


def test_serialize_message_exposes_media():
    row = {
        "id": "m1",
        "source_id": "a1",
        "platform": "telegram",
        "platform_id": "123",
        "platform_message_id": "99",
        "sender_id": "s1",
        "sender_name": "Alice",
        "content": "caption",
        "timestamp": "2026-01-01T00:00:00Z",
        "raw_data": json.dumps({"media": {"kind": "photo", "mime": "image/jpeg"}}),
        "created_at": "2026-01-01T00:00:00Z",
        "channel_name": "Test",
    }
    wire = serialize_message(row)
    assert wire["media"] == {"kind": "photo", "mime": "image/jpeg"}
