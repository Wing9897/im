# Agent-to-Agent（客戶經理 / Account manager）

對外只暴露 **一條自然語言 Agent API**。OpenClaw、Hermes 等第三方只需在 prompt 裡說明「可呼叫本機這個 agent」，用日常語言交辦即可——**不必**為本產品設計專用 events CRUD。

人類通道：`POST /api/v1/agent/chat`（見 [`assistant.md`](assistant.md)）。  
A2A 通道：`POST /api/v1/a2a/agent`（本文件）。

兩者共用同一 `AgentRuntime` + 工具 + LLM key；**system prompt 不同**；A2A **不在伺服器保存對話 session**。

## 認證

- **僅** household access key（`Authorization: Bearer <key>`）。
- **拒絕** device session；loopback 豁免**不**適用。
- 金鑰需 `a2a:agent` 或 `*`（舊 scope `a2a:events` 已硬切拒絕，不再改寫）。
- 非 `*` 金鑰全站僅允許 `/api/v1/a2a/`。
- 建立：勾選「僅限客戶經理」→ `scopes: ["a2a:agent"]`（API 欄位 `allowA2aAgent`）。

## API

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/v1/a2a/agent` | 自然語言任務；伺服器內部 tool loop；**單次**回應 |

### Request

```json
{
  "input": "查明天有什麼會議；另外每週三早上十點睇電視幫我設循環行程",
  "locale": "zh-Hant"
}
```

可選 `messages`：由**第三方**自行保存的先前輪次，僅用於**本次**請求（本服務不落庫、不恢復 session）。若同時給 `input`，會接在 `messages` 之後。

### Response（單次，類似網頁版 agent）

```json
{
  "message": "明天沒有會議。已建立每週三 10:00「睇電視」循環行事曆任務。",
  "sessionId": null,
  "toolCalls": [
    { "name": "calendar.upcoming", "arguments": { "days": 1 }, "resultSummary": "…" },
    { "name": "calendar.create_recurring_task", "arguments": { "…" }, "resultSummary": "…" }
  ],
  "error": null
}
```

- `message`：給第三方 agent 的最終結果（給人／給上游模型皆可）。
- `toolCalls`：內部用過哪些工具的摘要（說明／除錯用），**不是**要第三方逐步重放的協議。
- 無串流進度協議要求；無需對接本產品的 events schema。

需要本機已設定可用的 **AI 供應商**。

經工具建立的用戶事件 `origin=a2a`。每次呼叫寫入 `a2a_audit_log`（永不記 secret）。

## 非目標

- 專用 events CRUD 門面（已移除）
- 伺服器端多輪 session／歷史庫
- 要求第三方為本 API 設計特殊工具 schema
- device session 呼叫 A2A

## 相關程式

- Route: `server/api/routes/a2a_agent.py`
- Channel: `server/agent/channels.py` + `AgentRuntime`
- Auth: `server/api/a2a_auth.py`
- 人類助手: [`assistant.md`](assistant.md)
