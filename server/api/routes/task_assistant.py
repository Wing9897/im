"""Chat-assistant endpoint: turns a conversation into a draft task config.

Mounted before the tasks CRUD router so ``/chat-assistant`` is never captured
by the ``/{task_id}`` path parameter.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from server.api.deps import API_DEPS, get_analysis_engine
from server.api.schemas.responses import ChatAssistantResponse, TaskDraftPayload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"], dependencies=API_DEPS)


class ChatAssistantBody(BaseModel):
    messages: list[dict[str, Any]]
    currentTask: Optional[TaskDraftPayload] = None
    #: Optional UI locale (`zh-Hant` | `zh-Hans` | `en`); falls back to server ``ui_locale``.
    locale: Optional[str] = None


@router.post("/chat-assistant", response_model=ChatAssistantResponse)
async def chat_assistant(request: Request, body: ChatAssistantBody) -> ChatAssistantResponse:
    engine = get_analysis_engine(request)
    last_user_message = ""
    for message in reversed(body.messages):
        if message.get("role") == "user":
            last_user_message = str(message.get("content") or "")
            break
    if not last_user_message:
        return ChatAssistantResponse(message="請描述您想要監控或分析的內容。", taskConfig=None)
    current_task = body.currentTask.model_dump(exclude_none=True) if body.currentTask is not None else None
    try:
        result = await engine.handle_chat_assistant(
            last_user_message,
            current_task=current_task,
            locale=body.locale,
        )
        return ChatAssistantResponse.model_validate(result)
    except Exception as exc:  # noqa: BLE001 — assistant must degrade gracefully
        logger.warning("Chat assistant failed: %s", exc)
        return ChatAssistantResponse(
            message="AI 引擎目前無法使用，請檢查設定頁的 LLM 配置後再試。",
            taskConfig=None,
        )
