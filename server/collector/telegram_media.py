"""Telegram message media detection and delayed download helpers."""

from __future__ import annotations

import json
from io import BytesIO
from typing import Any, Optional

from telethon.tl.types import DocumentAttributeAnimated, Message

MediaKind = str  # photo | video | gif | sticker | audio | file


def extract_telegram_media(message: Message) -> Optional[dict[str, Any]]:
    """Return a lightweight media descriptor for ``raw_data``, or None for text-only."""
    photo = getattr(message, "photo", None)
    video = getattr(message, "video", None)
    sticker = getattr(message, "sticker", None)
    voice = getattr(message, "voice", None)
    document = getattr(message, "document", None)
    if photo:
        return {"kind": "photo", "mime": "image/jpeg"}
    if video:
        mime = getattr(video, "mime_type", None) or "video/mp4"
        return {"kind": "video", "mime": mime}
    if sticker:
        return {"kind": "sticker", "mime": "image/webp"}
    if voice:
        return {"kind": "audio", "mime": "audio/ogg"}
    if document:
        mime = getattr(document, "mime_type", None) or "application/octet-stream"
        attributes = getattr(document, "attributes", None) or []
        animated = any(isinstance(attr, DocumentAttributeAnimated) for attr in attributes)
        if animated or mime == "image/gif":
            return {"kind": "gif", "mime": mime}
        return {"kind": "file", "mime": mime}
    return None


def build_telegram_raw_data(message: Message) -> Optional[str]:
    """Serialize optional media metadata into the messages.raw_data JSON column."""
    media = extract_telegram_media(message)
    if media is None:
        return None
    return json.dumps({"media": media}, ensure_ascii=False)


async def download_telegram_media_bytes(client: Any, message: Message) -> tuple[bytes, str]:
    """Download media for *message* into memory; never writes to disk."""
    media = extract_telegram_media(message)
    if media is None:
        raise ValueError("Message has no media")

    buffer = BytesIO()
    kind = media["kind"]
    if kind in ("video", "gif"):
        await client.download_media(message, file=buffer, thumb=-1)
        mime = media.get("mime") or "image/jpeg"
    else:
        await client.download_media(message, file=buffer)
        mime = media.get("mime") or "application/octet-stream"
    return buffer.getvalue(), str(mime)
