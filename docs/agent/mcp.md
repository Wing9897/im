# MCP 控制面（Streamable HTTP）

對外暴露 **結構化工具面**（Model Context Protocol），供 OpenClaw 等外部 Agent **直接**呼叫本機日曆／訊息／情報／物品工具。本機 **不**在此通道跑 LLM tool loop——呼叫方自己選工具、傳參數。

人類助手：`POST /api/v1/agent/chat`（見 [`assistant.md`](assistant.md)）。  
A2A 自然語言門面：`POST /api/v1/a2a/agent`（見 [`a2a.md`](a2a.md)）。  
MCP 工具門面：`/api/v1/mcp`（本文件；Streamable HTTP）。

MCP 與助手／A2A **共用**同一批 base tool handlers（`execute_tool`）；**不**注入 `web.search`／`web.fetch`／`tasks.consult_advisor`；**不**需要本機 AI 供應商即可 list／call。

設定頁：`/settings/integrations?tab=mcp`（MCP 總開關 + 連線測試 + 能力群組）。同一能力群組也出現在 `/settings/integrations?tab=a2a`（MCP 與 A2A 共用；A2A 另有獨立總開關 `a2a_enabled`）。工作集可見性在 `/worksets`（每張工作集的「外部接口」；`worksets.external_enabled`）。預設 `mcp_enabled=true`；關閉後 MCP 協議入口回 403。能力群組預設全開，**同時**約束 MCP `list_tools`／`call_tool` 與 A2A 內部 tool loop（各自總開關開啟時）。新建工作集預設 `external_enabled=1`。

## 與 A2A 的區別

| | A2A | MCP |
|--|-----|-----|
| 介面 | 自然語言 `input`／`messages` | MCP `list_tools`／`call_tool` |
| 誰跑 tool loop | **本機** `AgentRuntime` + LLM | **外部** Agent（OpenClaw 等） |
| 是否需本機 LLM | 需要 | **不需要** |
| 傳輸 | JSON `POST /api/v1/a2a/agent` | Streamable HTTP `/api/v1/mcp` |
| 寫入溯源 | `user_events.origin=a2a` | `user_events.origin=mcp` |

兩者鑑權相同（household access key + scope `"*"`）。需要「用一句話交辦、由本機選工具」→ A2A；需要「外部 Agent 結構化控本系統」→ MCP。家庭層 `mcp_cap_*` 能力群組與 `worksets.external_enabled` 對兩條通道同一套（A2A 不是繞過 MCP 開關的後門）。`mcp_enabled` 只關 MCP HTTP；`a2a_enabled` 只關 A2A HTTP。

## 總開關（`mcp_enabled`）

- `system_config` 鍵：`mcp_enabled`（設定頁 wire：`mcpEnabled`），**預設 `"true"`**。
- 為 `false` 時：Streamable HTTP `/api/v1/mcp`（含尾斜線）對所有方法回 **403**，訊息含 `mcp_enabled=false`；`list_tools`／`call_tool` 不可用。
- 能力群組開關在總開關關閉時仍可編輯／保存：MCP 協議面已關閉故不套用到 MCP；**A2A 仍套用**同一套群組（若 `a2a_enabled` 為開）。

## 設定頁連線測試（session auth）

- `GET /api/v1/mcp/status`：走一般 API 鑑權（裝置 session 或 Bearer 存取金鑰；與多數讀取型端點相同），**不**要求 A2A／MCP 協議面用的完整 `*` access key。
- 回應：`{ enabled, toolCount, tools: [{ name, description }] }`。`enabled=false` 時 `tools` 為空；為 true 時 `tools` 已依目前 `mcp_cap_*` 過濾。
- 設定頁「測試連線」按鈕呼叫此端點（使用目前登入 session），顯示成功與工具數量／名稱，或總開關關閉／錯誤時的明確失敗訊息。UI **不**要求貼上 access key。

## 認證

- **僅** household access key（`Authorization: Bearer <key>`）可打 Streamable HTTP 協議面。
- **拒絕** device session；loopback 豁免**不**適用。
- 金鑰需完整 scope `["*"]`（`read` 只讀金鑰不可呼叫 MCP；與 A2A 同一門檻：`require_full_access_key`）。
- **不**新增細粒度 **access-key** scope（例如 `calendar:write`）。帳戶 → 存取金鑰只產生完整 `*`（UI 無唯讀／scopes 選項）；既有 `read` 金鑰仍可用，列表僅顯示「唯讀」狀態。能力群組在設定 → 外部接口 → MCP **與** A2A（同一套 `mcp_cap_*`），與金鑰 read/`*` 正交。
- 家庭層 **能力群組**（`system_config` `mcp_cap_*`）可過濾 MCP 暴露的工具，並在 A2A tool loop 省略／攔截同一批工具；這**不是**金鑰 scope。
- 家庭層 **工作集權限**（`worksets.external_enabled`；工作集頁「外部接口」）過濾情報／訊息／物品等以工作集為鍵的工具資料；**不是**金鑰 scope。預設開。全關 = fail closed。日曆「我的日程」為家庭層，不套用。內建助手不受約束。

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

## 工具範圍（最多 20）

Allowlist = `BASE_TOOL_HANDLERS`（日曆 + `messages.search` + `intelligence.search_events` + 物品 + 唯讀 `worksets.list`）。`user_event_origin` 固定為 `"mcp"`。不開放 MCP 建／刪工作集。

能力群組（設定頁勾選；`system_config` 鍵預設 `"true"`）：

| 群組 | `system_config` | 工具 |
|------|-----------------|------|
| 日曆讀 | `mcp_cap_calendar_read` | `calendar.list_calendars` / `upcoming` / `recent` / `window` / `get` |
| 日曆寫 | `mcp_cap_calendar_write` | create/update/delete event & recurring；mark/unmark important |
| 訊息搜尋 | `mcp_cap_messages_search` | `messages.search` |
| 情報搜尋 | `mcp_cap_intelligence_search` | `intelligence.search_events` |
| 物品讀 | `mcp_cap_items_read` | `items.list` / `items.list_expiring` |
| 物品寫 | `mcp_cap_items_write` | `items.create` / `items.update` |
| 工作集讀 | （無獨立 `mcp_cap_*`；MCP 開啟即有） | `worksets.list` |

工作集權限（工作集頁「外部接口」；`worksets.external_enabled` 預設 1）：

| 狀態 | 行為 |
|------|------|
| 開（預設） | 該工作集對 MCP／A2A 的情報／訊息／物品可見、可寫；`worksets.list` 會列出 |
| 關 | 該工作集從 MCP／A2A 隱藏。全部關閉時 fail closed |

套用：`intelligence.search_events`、`messages.search`、`items.*`、`worksets.list`。不套用：日曆「我的日程」、`web.search`、內建助手。

| 工具 | 類別 |
|------|------|
| `calendar.list_calendars` | 日曆讀 |
| `calendar.upcoming` | 日曆讀 |
| `calendar.recent` | 日曆讀 |
| `calendar.window` | 日曆讀 |
| `calendar.get` | 日曆讀 |
| `calendar.create_event` | 日曆寫 |
| `calendar.update_event` | 日曆寫 |
| `calendar.delete_event` | 日曆寫（時間規劃 soft-dismiss，非 REST 硬刪） |
| `calendar.create_recurring_series` | 日曆寫（循環；可選 `worksetId`，預設同 `create_event` → `__general__`） |
| `calendar.update_recurring_series` | 日曆寫（循環；可改 `worksetId`） |
| `calendar.delete_recurring_series` | 日曆寫（循環） |
| `calendar.mark_important` | 日曆寫 |
| `calendar.unmark_important` | 日曆寫 |
| `messages.search` | 訊息 |
| `intelligence.search_events` | 情報 |
| `items.list` | 物品讀 |
| `items.list_expiring` | 物品讀 |
| `items.create` | 物品寫 |
| `items.update` | 物品寫 |
| `worksets.list` | 工作集讀（id／name／notifyEnabled／externalEnabled；MCP／A2A 僅 `external_enabled`） |

- `list_tools` 只回傳目前啟用群組內的工具。
- `call_tool` 對關閉群組回傳 `{"error": "mcp capability disabled: <group>"}`；allowlist 外仍為 `tool not allowed: …`。

## 危險寫入護欄（MCP-only）

經 MCP 呼叫下列工具時，參數必須含 **`confirm: true`**（布林字面量）：

- `calendar.delete_event`（仍是時間規劃 soft-dismiss，與 `PUT /calendar/dismissals` 相同；不是硬刪 `user_events`）
- `calendar.delete_recurring_series`（硬刪系列）

缺少或非 `true` 時回傳明確錯誤（要求重試並帶 `confirm=true`）。助手／A2A 共用 handler **不**強制此欄位。MCP 暴露的 tool schema 描述與 `inputSchema` 已標註該要求，供 OpenClaw 等客戶端看見。

## 明確不暴露

- `web.search`（聯網搜）
- `web.fetch`（讀取頁面正文）
- `tasks.consult_advisor`（任務顧問）
- 分析任務／來源／Actions／LLM 設定／專案經理（`agent`）tick 控制面
- 工作集建／刪（僅唯讀 `worksets.list`）
- 把整份 OpenAPI 包成 MCP tools
- 設定類／系統組態 MCP tools（保留給用戶 UI；總開關與能力群組走 `/config/settings`）

## 寫入溯源 / schema

經 MCP 工具建立或改寫的用戶事件：`origin=mcp`（客戶端不可偽造）。寫入會走既有 `resource_modified`／SSE 失效路徑。

**Schema：** `user_events.origin` 含 `mcp`。當前基線為 stamp **7**／`SCHEMA_SEMVER` `1.6.0`（`SCHEMA_FLOOR` 7；stamp 1–6 須備份後 reset）。未來 stamp 硬拒絕 → 升級應用；壞庫 → `python scripts/reset_local_databases.py --apply`。整庫矩陣以 [`SCHEMA-BASELINE.md` Schema support matrix](../SCHEMA-BASELINE.md#schema-support-matrix) 為準。`mcp_enabled`／`a2a_enabled`／`mcp_cap_*` 為 `system_config` 鍵；工作集可見性為 `worksets.external_enabled`。

## 非目標

- stdio transport
- 細粒度 **access-key** scope（能力群組 ≠ 金鑰 scope）
- 設定／任務／來源／通知／LLM 的 MCP 包裝（除本頁總開關／能力群組外）
- 讓內置助手「追平 OpenClaw」產品體驗
