# Agent-to-Agent（客戶經理 / Account manager）

對外只暴露 **一條自然語言 Agent API**。OpenClaw、Hermes 等第三方只需在 prompt 裡說明「可呼叫本機這個 agent」，用日常語言交辦即可——**不必**為本產品設計專用 events CRUD。

人類通道：`POST /api/v1/agent/chat`（見 [`assistant.md`](assistant.md)）。  
A2A 通道：`POST /api/v1/a2a/agent`（本文件）。  
結構化工具門面（無本機 LLM）：Streamable HTTP `/api/v1/mcp`（見 [`mcp.md`](mcp.md)）。

兩者共用同一 `AgentRuntime` + 工具 + LLM（含訊息／情報／日程／物品寫入；與後勤 `analysis_mode=agent` tick **不同**——tick 不開 `items.create`／`items.update`）；**system prompt 不同**；A2A **不在伺服器保存對話 session**。

**LLM 解析：** A2A 為 sessionless，一律硬綁全局 **`liaison`** 槽位（`llm_global_slot_liaison`；槽位空 → 400），**不**借用助手槽、**不**接受／不儲存 per-session `llmProfileId`。人類助手聊天另走 `assistant` 槽；可在請求／`ui-prefs` session 上帶可選 `llmProfileId` 覆蓋。

## 認證

- **僅** household access key（`Authorization: Bearer <key>`）。
- **拒絕** device session；loopback 豁免**不**適用。
- 金鑰需完整 scope `["*"]`（`read` 只讀金鑰不可呼叫 A2A；舊 `a2a:agent` / `a2a:events` 已硬切拒絕）。
- 建立：預設完整金鑰；勾選「只讀」→ `scopes: ["read"]`（API 欄位 `readOnly`）。

## API

| Method | Path | 說明 |
|--------|------|------|
| POST | `/api/v1/a2a/agent` | 自然語言任務；伺服器內部 tool loop；**單次**回應 |

### Request

```json
{
  "input": "查明天有什麼會議；另外每週三早上十點睇電視幫我設週期任務",
  "locale": "zh-Hant"
}
```

可選 `messages`：由**第三方**自行保存的先前輪次，僅用於**本次**請求（本服務不落庫、不恢復 session）。若同時給 `input`，會接在 `messages` 之後。

### Response（單次）

與 `/agent/chat` **final** 同形（`message`／`sessionId`／`toolCalls`）；契約見 [`assistant.md`](./assistant.md)。`toolCalls` 僅供說明／除錯，不是逐步重放協議。無串流進度要求。

需要本機已設定可用的 **AI 供應商**。

### 錯誤（真 HTTP 錯誤碼）

成功才回 200；失敗一律走標準結構化錯誤體 `{error_code, message, details, correlation_id}`，**不再**用 200 + `error` 欄位。

| Status | `error_code` | 情境 |
|--------|--------------|------|
| 422 | `VALIDATION_ERROR` | `input` 空白且 `messages` 沒有 `role=user` 的一輪 |
| 400／404 | `VALIDATION_ERROR`／`NOT_FOUND` | `liaison` 槽位未設定、設定檔不存在或不完整 |
| 502 | `ai_engine_failed` | 上游 LLM 呼叫失敗（回應無法解析、供應商錯誤等） |
| 503 | `ai_engine_unreachable` | 供應商主機連不上（本機 Ollama 未啟動、埠號錯誤） |
| 504 | `agent_timeout` | 整體 wall-clock 逾時 |

映射集中在 `server/api/agent_errors.py`，與 `/agent/chat` 共用。

經工具建立的用戶事件 `origin=a2a`。呼叫結果寫入應用日誌（不再使用獨立 `a2a_audit_log` 表）。

## 非目標

- 專用 events CRUD 門面（已移除）
- 伺服器端多輪 session／歷史庫
- 應用內 TLS／憑證管理（port-forward 須在 Caddy／Nginx 終止 TLS）
