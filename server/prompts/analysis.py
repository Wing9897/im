"""Analysis pipeline prompt texts (JSON schema + strategy).

Assembled at runtime by ``server.analyzer.prompt``; task ``promptTemplate``
values remain in SQLite ``analysis_tasks``.
"""

from __future__ import annotations

#: Strict-JSON preamble; without it some models reply in markdown prose.
JSON_OUTPUT_PREAMBLE = (
    "\n\n---\n重要輸出格式要求（必須遵守）：\n只輸出一個 JSON 物件，不要輸出任何其他文字、說明或 markdown 圍欄。\n"
)

#: Header for the existing-leaderboard JSON context block injected into the
#: system prompt; assembled in ``server.analyzer.prompt.build_leaderboard_context_block``.
LEADERBOARD_CONTEXT_HEADER = (
    "既有排行榜（目前前十名主題與分數；請在本批訊息基礎上輸出/更新 topic 與 score，無需 rank）："
)

LEADERBOARD_SCHEMA_INSTRUCTION = (
    '格式為：{"items": [{"topic": "主題", "score": 0.8, '
    '"summary": "摘要", "related_message_ids": ["..."]}]}\n'
    "每個 item 必須包含 topic 與 score。\n"
    "score 為 0 到 1 之間的浮點數（熱度／相關度）。\n"
    "不要輸出 rank；系統會依 score 與目前前十名自動排名。\n"
    "summary 為主題摘要字串。\n"
    "related_message_ids 為選擇性陣列：若能對應到上方訊息行首以 [id=...] 標註的訊息 ID，"
    "請列出對應 ID；無法對應則省略。\n"
    '若無任何主題，回傳 {"items": []}。'
)

EVENT_SCHEMA_INSTRUCTION = (
    '格式為：{"items": [{"title": "標題", "body": "詳細內容", '
    '"start_time": "2025-01-01T09:00:00Z", "end_time": "2025-01-01T10:00:00Z", '
    '"location": "地點", "participants": ["參與者"], "source_message_id": "..."}]}\n'
    "每個 item 必須包含 title 與 body；其餘欄位皆為選擇性。\n"
    "只允許上述欄位名稱；禁止自造 JSON key。"
    "情報類型、緊急程度、操作步驟、風險提示等補充資訊請寫進 body 文字，不要另開欄位。\n"
    "start_time / end_time 請使用 ISO 8601（UTC，結尾加 Z）。\n"
    "【時間】僅在訊息有可落地時間時才填寫（明確時間，或可結合行首 [time=...]／上方注入的當前時間換算的相對時間，"
    "例如「下星期三六點」「下個月截止」）。"
    "沒有可排程時間就省略 start_time/end_time，禁止無依據猜測或用無關歷史年份充數。\n"
    "【地點】盡可能依上下文推斷可辨識地點；location 必須夠詳細以便地理編碼，"
    "至少寫到「國家／州省＋城市或場館」（例如「美國德克薩斯州」「中國山東省德州市」），"
    "避免只寫易歧義短名（如單獨「德州」可能是美國 Texas 或中國德州）。"
    "中英同名或常見譯名衝突時，依語境選正確國家並寫進 location；"
    "可依訊息內容、專有名詞、活動語境合理判斷，不必要求原文出現完整地名。"
    '若屬於全球／網上／線上／無特定實體位置，或完全無法形成地點，請填 location 為 "全球" 或省略；'
    "系統會將此類項目座標設為 0,0。禁止編造不存在的具體地名。\n"
    "participants 為選擇性參與者／相關人員字串陣列。\n"
    "不要提取：群組驗證、加入頻道提醒、系統通知、ban 警告、純閒聊、無資訊價值的轉貼。\n"
    "source_message_id 為選擇性字串：若能對應到上方訊息行首以 [id=...] 標註的來源訊息 ID，"
    "請填入；無法對應則省略。\n"
    "有時間的項目可進時間線；地點會用於地圖（無特定位置則落在 0,0）。\n"
    '若無任何內容，回傳 {"items": []}。'
)

STRATEGY_INSTRUCTIONS = {
    "conservative": (
        "\n\n[Analysis strategy: conservative]\n"
        "只輸出有直接訊息證據且高可信度的結果；不確定時寧可省略，禁止推測。"
        "（此設定管「哪些情報值得輸出」。）"
    ),
    "balanced": (
        "\n\n[Analysis strategy: balanced]\n"
        "兼顧準確度與覆蓋度；每項結果必須可由訊息內容支持，避免無根據推測。"
        "（此設定管「哪些情報值得輸出」。）"
    ),
    "aggressive": (
        "\n\n[Analysis strategy: aggressive]\n"
        "提高有效線索的覆蓋度，但仍必須有訊息證據；模糊或重複內容應合併而非編造。"
        "（此設定管「哪些情報值得輸出」。）"
    ),
}
