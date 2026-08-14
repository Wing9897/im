# MCP 控制面（Streamable HTTP）

對外暴露 **結構化工具面**（Model Context Protocol），供 OpenClaw 等外部 Agent **直接**呼叫本機日曆／訊息／情報／物品工具。本機 **不**在此通道跑 LLM tool loop——呼叫方自己選工具、傳參數。

人類助手：`POST /api/v1/agent/chat`（見 [`assistant.md`](assistant.md)）。  
A2A 自然語言門面：`POST /api/v1/a2a/agent`（見 [`a2a.md`](a2a.md)）。  
MCP 工具門面：`/api/v1/mcp`（本文件；Streamable HTTP）。

MCP 與助手／A2A **共用**同一批 base tool handlers（`execute_tool`）；**不**注入 `web.search`／`tasks.consult_advisor`；**不**需要本機 AI 供應商即可 list／call。

設定頁：`/settings/mcp`（總開關 + 連線測試 + 能力群組）。預設 `mcp_enabled=true`；關閉後協議入口回 403。能力群組預設全開。

## 與 A2A 的區別

| | A2A | MCP |
|--|-----|-----|
| 介面 | 自然語言 `input`／`messages` | MCP `list_tools`／`call_tool` |
| 誰跑 tool loop | **本機** `AgentRuntime` + LLM | **外部** Agent（OpenClaw 等） |
| 是否需本機 LLM | 需要 | **不需要** |
| 傳輸 | JSON `POST /api/v1/a2a/agent` | Streamable HTTP `/api/v1/mcp` |
| 寫入溯源 | `user_events.origin=a2a` | `user_events.origin=mcp` |

兩者鑑權相同（household access key + scope `"*"`）。需要「用一句話交辦、由本機選工具」→ A2A；需要「外部 Agent 結構化控本系統」→ MCP。

## 總開關（`mcp_enabled`）

- `system_config` 鍵：`mcp_enabled`（設定頁 wire：`mcpEnabled`），**預設 `"true"`**。
- 為 `false` 時：Streamable HTTP `/api/v1/mcp`（含尾斜線）對所有方法回 **403**，訊息含 `mcp_enabled=false`；`list_tools`／`call_tool` 不可用。
- 能力群組開關在總開關關閉時仍可編輯／保存，但不會生效（協議面已關閉）。

## 設定頁連線測試（session auth）

- `GET /api/v1/mcp/status`：走一般 API 鑑權（裝置 session 或 Bearer 存取金鑰；與多數讀取型端點相同），**不**要求 A2A／MCP 協議面用的完整 `*` access key。
- 回應：`{ enabled, toolCount, tools: [{ name, description }] }`。`enabled=false` 時 `tools` 為空；為 true 時 `tools` 已依目前 `mcp_cap_*` 過濾。
- 設定頁「測試連線」按鈕呼叫此端點（使用目前登入 session），顯示成功與工具數量／名稱，或總開關關閉／錯誤時的明確失敗訊息。UI **不**要求貼上 access key。

## 認證

- **僅** household access key（`Authorization: Bearer <key>`）可打 Streamable HTTP 協議面。
- **拒絕** device session；loopback 豁免**不**適用。
- 金鑰需完整 scope `["*"]`（`read` 只讀金鑰不可呼叫 MCP；與 A2A 同一門檻：`require_full_access_key`）。
- **不**新增細粒度 **access-key** scope（例如 `calendar:write`）。建立金鑰：預設完整；勾選「只讀」→ `scopes: ["read"]`（見 `/account/keys`）。
- 家庭層 **能力群組**（`system_config` `mcp_cap_*`，設定頁開關）可過濾 MCP 暴露的工具；這**不是**金鑰 scope。

## 傳輸 / OpenClaw

- **只做** Streamable HTTP。入口前綴：`/api/v1/mcp`（完整 URL 形如 `{apiOrigin}/api/v1/mcp`）。
- Streamable HTTP 協議流量是 **ASGI mount**，**不**進入 OpenAPI；OpenAPI 僅收錄 session-auth 的 `GET /api/v1/mcp/status`。
- **不做** stdio／SSE-only 舊傳輸／本機子行程 MCP server。

OpenClaw 側概念配置（寫入 `~/.openclaw/openclaw.json` 的 `mcp.servers`；金鑰請換成 `/account/keys` 建立的完整 `*` 金鑰）。預設 API origin 為 `http://127.0.0.1:18820`（SoT：`server/constants.py` 的 `SERVICE_PORT`）：

```json
{
  "mcp": {
    "servers": {
      "intelligence-monitor": {
        "url": "http://127.0.0.1:18820/api/v1/mcp",
        "transport": "streamable-http",
        "headers": {
          "Authorization": "Bearer <access-key>"
        }
      }
    }
  }
}
```

握手與每次 tool call 都須帶 Bearer。可用 OpenClaw 的 `mcp probe`／設定檢查對上述 URL 做連通性驗證。細節以官方 MCP Streamable HTTP 與本機 SDK 掛載為準。

## 工具範圍（最多 19）

Allowlist = `BASE_TOOL_HANDLERS`（日曆 + `messages.search` + `intelligence.search_events` + 物品）。`user_event_origin` 固定為 `"mcp"`。

能力群組（設定頁勾選；`system_config` 鍵預設 `"true"`）：

| 群組 | `system_config` | 工具 |
|------|-----------------|------|
| 日曆讀 | `mcp_cap_calendar_read` | `calendar.list_calendars` / `upcoming` / `recent` / `window` / `get` |
| 日曆寫 | `mcp_cap_calendar_write` | create/update/delete event & recurring；mark/unmark important |
| 訊息搜尋 | `mcp_cap_messages_search` | `messages.search` |
| 情報搜尋 | `mcp_cap_intelligence_search` | `intelligence.search_events` |
| 物品讀 | `mcp_cap_items_read` | `items.list` / `items.list_expiring` |
| 物品寫 | `mcp_cap_items_write` | `items.create` / `items.update` |

| 工具 | 類別 |
|------|------|
| `calendar.list_calendars` | 日曆讀 |
| `calendar.upcoming` | 日曆讀 |
| `calendar.recent` | 日曆讀 |
| `calendar.window` | 日曆讀 |
| `calendar.get` | 日曆讀 |
| `calendar.create_event` | 日曆寫 |
| `calendar.update_event` | 日曆寫 |
| `calendar.delete_event` | 日曆寫 |
| `calendar.create_recurring_series` | 日曆寫（循環） |
| `calendar.update_recurring_series` | 日曆寫（循環） |
| `calendar.delete_recurring_series` | 日曆寫（循環） |
| `calendar.mark_important` | 日曆寫 |
| `calendar.unmark_important` | 日曆寫 |
| `messages.search` | 訊息 |
| `intelligence.search_events` | 情報 |
| `items.list` | 物品讀 |
| `items.list_expiring` | 物品讀 |
| `items.create` | 物品寫 |
| `items.update` | 物品寫 |

- `list_tools` 只回傳目前啟用群組內的工具。
- `call_tool` 對關閉群組回傳 `{"error": "mcp capability disabled: <group>"}`；allowlist 外仍為 `tool not allowed: …`。

## 危險寫入護欄（MCP-only）

經 MCP 呼叫下列工具時，參數必須含 **`confirm: true`**（布林字面量）：

- `calendar.delete_event`
- `calendar.delete_recurring_series`

缺少或非 `true` 時回傳明確錯誤（要求重試並帶 `confirm=true`）。助手／A2A 共用 handler **不**強制此欄位。MCP 暴露的 tool schema 描述與 `inputSchema` 已標註該要求，供 OpenClaw 等客戶端看見。

## 明確不暴露

- `web.search`（聯網搜）
- `tasks.consult_advisor`（任務顧問）
- 分析任務／來源／Actions／LLM 設定／專案經理（`agent`）tick 控制面
- 把整份 OpenAPI 包成 MCP tools
- 設定類／系統組態 MCP tools（保留給用戶 UI；總開關與能力群組走 `/config/settings`）

## 寫入溯源 / schema

經 MCP 工具建立或改寫的用戶事件：`origin=mcp`（客戶端不可偽造）。寫入會走既有 `resource_modified`／SSE 失效路徑。

**Schema：** `user_events.origin` 含 `mcp`（自 stamp 30 起；當前 wipe-floor 為 stamp **33**／`SCHEMA_SEMVER` `0.1.0-beta.34`）。非當前 stamp 硬拒絕 → `python scripts/reset_local_databases.py --apply`。整庫矩陣以 [`SCHEMA-BASELINE.md` Schema support matrix](../SCHEMA-BASELINE.md#schema-support-matrix) 為準。`mcp_enabled`／`mcp_cap_*` 為 `system_config` 鍵，**不**需 stamp bump。

## 非目標

- stdio transport
- 細粒度 **access-key** scope（能力群組 ≠ 金鑰 scope）
- 設定／任務／來源／通知／LLM 的 MCP 包裝（除本頁總開關／能力群組外）
- 讓內置助手「追平 OpenClaw」產品體驗
