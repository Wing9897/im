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
- 建立：帳戶 → 存取金鑰只產生完整 `*` 金鑰（UI 無唯讀／scopes 選項）。既有 `read` 金鑰仍可用，列表僅顯示「唯讀」狀態。家庭層能力群組（`mcp_cap_*`）在設定 → 外部接口 → MCP **與** A2A 顯示同一套開關；工作集可見性在工作集頁「外部接口」（`worksets.external_enabled`）。與金鑰 read/`*` 正交；**不是** per-key scope。

## 總開關（`a2a_enabled`）

- `system_config` 鍵：`a2a_enabled`（設定頁 wire：`a2aEnabled`），**預設 `"true"`**。與 `mcp_enabled` **互不控制**。
- 為 `false` 時：`POST /api/v1/a2a/agent`（以及 `/api/v1/a2a` 下其他 HTTP）回 **403**，`error_code=FORBIDDEN`，訊息含 `a2a_enabled=false`。能力群組在總開關關閉時不套用到 A2A。
- 設定頁：`/settings/integrations?tab=a2a` 先顯示「啟用 A2A」，再顯示共用能力群組。

## 能力群組（與 MCP 共用）

A2A 只有一條 HTTP 方法（`POST /api/v1/a2a/agent`）。細粒度門檻是內部 tool loop 對 `execute_tool` 的允許清單，映射到既有 MCP 群組（不另造 A2A-only 開關）：

| 群組 | `system_config` | A2A 工具 |
|------|-----------------|----------|
| 日曆讀 | `mcp_cap_calendar_read` | `calendar.list_calendars` / `upcoming` / `recent` / `window` / `get` |
| 日曆寫 | `mcp_cap_calendar_write` | create/update/delete event & recurring；mark/unmark important |
| 訊息搜尋 | `mcp_cap_messages_search` | `messages.search` |
| 情報搜尋 | `mcp_cap_intelligence_search` | `intelligence.search_events` |
| 物品讀 | `mcp_cap_items_read` | `items.list` / `items.list_expiring` |
| 物品寫 | `mcp_cap_items_write` | `items.create` / `items.update` |
| 工作集讀 | （無獨立 `mcp_cap_*`；A2A 開啟即有） | `worksets.list` |

關閉某群組時：system prompt 不列出該批工具；若模型仍呼叫，`execute_tool` 回傳 `calendar_read_disabled`／`calendar_writes_disabled` 等。內建助手（`channel=assistant`）**不受**這些家庭層開關約束。

## 工作集權限（與 MCP 共用）

每張工作集的「外部接口」（`worksets.external_enabled`，預設開；內建「一般」可關）。關則該工作集對 MCP **和** A2A 的情報／訊息／物品不可見、不可寫，且不出現在 `worksets.list`。全部關閉 fail closed。日曆「我的日程」不套用。內建助手不受約束。開關在 `/worksets`，不在外部接口頁。

無對應群組的 A2A 工具：`worksets.list` 無獨立 `mcp_cap_*`（資料仍受 `external_enabled`）；`web.search` 仍走既有助手聯網設定（不是 `mcp_cap_*`）；`tasks.consult_advisor` 本就不在 A2A（僅助手 task editor）。`mcp_enabled` 只關 MCP HTTP；`a2a_enabled` 只關 A2A HTTP。兩者獨立。

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
| 403 | `FORBIDDEN` | `a2a_enabled=false`（家庭層 A2A 總開關關閉）；或缺金鑰／非 `*` |
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
