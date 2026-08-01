"""Platform-neutral message media retrieval service."""

from __future__ import annotations

import asyncio
from typing import Any

from server.util import parse_json_dict

_DOWNLOAD_TIMEOUT_SECONDS = 15.0
_download_semaphore = asyncio.Semaphore(4)


class MediaServiceError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class MessageMediaService:
    def __init__(self, db: Any, collector: Any) -> None:
        self._db = db
        self._collector = collector

    async def fetch(self, message_id: str) -> tuple[bytes, str]:
        row = await self._db.fetch_one("SELECT * FROM messages WHERE id = ?", (message_id,))
        if row is None:
            raise MediaServiceError(404, "Message not found")

        raw = parse_json_dict(row.get("raw_data"))
        media = raw.get("media") if isinstance(raw.get("media"), dict) else None
        if not media or not media.get("kind"):
            raise MediaServiceError(404, "Message has no media")
        if str(row["platform"]) != "telegram":
            raise MediaServiceError(404, "Media proxy only supports Telegram in v1")

        account_id = row.get("account_id")
        if not account_id:
            raise MediaServiceError(503, "Message has no linked account")
        if self._collector is None:
            raise MediaServiceError(503, "Collector is not running")

        adapter = self._collector.adapters.get(str(account_id))
        fetch_media = getattr(adapter, "fetch_media_bytes", None)
        if fetch_media is None:
            raise MediaServiceError(503, "Telegram account is not connected")

        platform_message_id = row.get("platform_message_id")
        if not platform_message_id:
            raise MediaServiceError(404, "Message has no platform message id")

        try:
            async with _download_semaphore:
                return await asyncio.wait_for(
                    fetch_media(str(row["platform_id"]), str(platform_message_id)),
                    timeout=_DOWNLOAD_TIMEOUT_SECONDS,
                )
        except asyncio.TimeoutError as exc:
            raise MediaServiceError(504, "Media download timed out") from exc
        except RuntimeError as exc:
            raise MediaServiceError(503, str(exc)) from exc
        except ValueError as exc:
            raise MediaServiceError(404, str(exc)) from exc
