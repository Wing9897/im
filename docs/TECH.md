[繁體中文](TECH.md) | [简体中文](TECH.zh-Hans.md) | [English](TECH.en.md)

# 技術文件

本文件是現行程式的技術總覽：程序怎麼跑、資料怎麼切、誰能打哪些 API。產品說明見 [README](../README.md)。MCP／A2A 的工具契約與錯誤碼以 [`agent/mcp.md`](agent/mcp.md)、[`agent/a2a.md`](agent/a2a.md) 為準——本文不複製整份工具列表。

## 1. 系統定位與程序

單一家庭、本機優先。預設不是多租戶 SaaS，也沒有內建 TLS。

| 程序 | 角色 |
|------|------|
| `web/` | React SPA（Vite）。開發時由 Vite 提供；正式環境由 API 程序提供靜態檔。 |
| FastAPI | REST `/api/v1/*`、SSE `/api/v1/events`。預設埠 **18820**（`server/constants.py` `SERVICE_PORT`），綁定 `0.0.0.0`（可用 `INTELLIGENCE_MONITOR_HOST` 覆寫）。 |
| Desktop（Electron） | 殼層。`host` 模式在本機拉起 API；`client` 模式只連遠端 origin。 |

健康檢查（無鑑權）：`GET /api/v1/health`，回傳產品版本、`schemaVersion`（整數 stamp）、`schemaSemver`。產品 SemVer（git tag／`VERSION`）與 schema stamp **解耦**。

資料根目錄（SQLite、`secret.key`、Telegram sessions）預設：

- Windows：`%APPDATA%/Intelligence Monitor`
- macOS：`~/Library/Application Support/Intelligence Monitor`
- Linux：`$XDG_CONFIG_HOME/Intelligence Monitor` 或 `~/.config/Intelligence Monitor`

可用 `INTELLIGENCE_MONITOR_DATA_DIR`／`INTELLIGENCE_MONITOR_DB` 覆寫。憑證用 Fernet 加密，金鑰在 `{DATA_DIR}/secret.key`。詳見 [`SECURITY.md`](../SECURITY.md)。

## 2. Schema stamp 7

SoT：`server/db/schema_inspect.py`。

| 常數 | 現值 |
|------|------|
| `CURRENT_SCHEMA_VERSION`／`PRAGMA user_version` | **7** |
| `SCHEMA_FLOOR` | **7**（與 current 相同） |
| `SCHEMA_SEMVER` | `1.6.0`（公開字串；不是 `user_version`） |
| 生產 `SCHEMA_MIGRATIONS` | **空**（`server/db/schema_steps.py`） |

空庫用 `server/db/schema.py` 聚合的 domain DDL 建立，再蓋 stamp 7。`FLOOR <= version < CURRENT` 才會走 additive walk——目前 floor＝current，所以這條路徑是空的。

啟動分類：

- stamp **1–6**：結構對不上現行基線 → **hard-reject**。先把庫檔拷出資料目錄，再 reset。沒有 1→7 的自動升級。
- stamp **> 7**（含已退役的 27／45）：當成**未來 stamp** → hard-reject，訊息要求先**升級應用**；reset 是最後手段。
- 指紋損壞或「長得很像但欄位不對」→ hard-reject，並印 reset 指令。
- 啟動**從不**默默刪庫或重建。

Reset（先停掉 Desktop／`npm run dev`）：

```bash
uv run python scripts/reset_local_databases.py --apply
```

腳本只刪已知的 `intelligence_monitor.db` 與 `-wal`／`-shm`，不刪備份、`secret.key`、sessions、`connection.json`。重啟後才長出現行 stamp。`--apply` **不**自動灌 demo。

## 3. 資料範圍

大多數業務列帶 `workset_id`。內建系統列 id 為 `__general__`（介面「一般」，`is_system=1`）。建立分析任務、手寫事件、物品時若省略工作集，落到 `__general__`。刪除自建工作集會先把下屬列改指 `__general__`；`__general__` 本身不能刪、不能改名。

側欄「工作集」是 `/worksets`。「任務設定」是**獨立路由** `/tasks`（不是工作集底下的分頁；舊的 `/tasks/worksets/…` 已移除）。`GET /api/v1/tasks` 只回分析任務；週期日曆系列走 `/api/v1/calendar/recurring`，不是任務目錄的一列。

工作集另有：

- `notify_enabled`：該集提醒預設
- `external_enabled`：MCP／A2A 是否看得到該集的情報／訊息／物品（預設開；全關則 fail closed）。日曆「我的日程」是家庭層，不套這欄。內建助手不受約束。

## 4. 鑑權

單一家庭管理員（`admin_accounts` 單例）＋裝置 session＋可撤銷存取金鑰。

**裝置 session**（登入後瀏覽器使用）：完整讀寫。建立：`POST /api/v1/setup/register`（首次）或 `/login`；刷新 `/setup/refresh`。帳戶頁可列／撤銷裝置。

**存取金鑰**（`Authorization: Bearer <key>`；SSE 可用 `?token=`）：

| scope | 用途 |
|-------|------|
| `*` | 完整讀寫。MCP／A2A **必須**。帳戶 UI 新建金鑰只發 `*`。 |
| `read` | 僅 GET／HEAD／OPTIONS。既有唯讀金鑰仍可用，列表顯示「唯讀」。 |

沒有更細的金鑰 scope（例如 `calendar:write`）。舊的 `a2a:agent`／`a2a:events` 建立時硬拒。能力群組 `mcp_cap_*` 與 `worksets.external_enabled` **不是**金鑰 scope。

**localhost：** `localhost_auth_exempt` 只在全新安裝、第一次 `POST /api/v1/setup/register` 前有效。管理員一旦存在，loopback 也不再豁免，每個請求都要 session 或金鑰。忘記密碼且沒有舊密碼：僅 loopback，且須把 Desktop `connection.json` 的 `resetPasswordForLocal` 設為 `true`（成功後伺服器會清回 `false`）。

**MCP／A2A 協議面：** 只收 household access key、只要 `*`、**拒絕** device session；loopback 豁免**不適用**。一般 REST（含 `GET /api/v1/mcp/status`）仍可用 session。

遠端寫入若既不是完整金鑰也不是 session，多數路徑 403（`/api/v1/viewer/` 除外）。沒有內建 TLS；對公網暴露時自己前面加反向代理。

## 5. HTTP API 前綴

業務 API 一律 `/api/v1`。主要群組（完整清單以 OpenAPI／原始碼為準）：

| 前綴 | 說明 |
|------|------|
| `/api/v1/setup` | 首次註冊、登入、刷新、裝置、改密 |
| `/api/v1/worksets` | 工作集 |
| `/api/v1/tasks` | 分析任務（含 templates、activity-spans、agent-ticks） |
| `/api/v1/sources`、`/messages`、`/channels` | 來源與已收訊息 |
| `/api/v1/results` | 情報事件（地圖／列表與日曆 window 分開） |
| `/api/v1/calendar` | `window`（分析＋手寫＋週期＋物品提醒合併）、`user-events`、`recurring`、`imports`（ICS 預覽／提交）、dismissals、importance、holidays |
| `/api/v1/items` | 物品 |
| `/api/v1/agent/chat` | 人類助手（本機 tool loop） |
| `/api/v1/a2a/agent` | A2A 自然語言門面（`POST`） |
| `/api/v1/mcp` | MCP Streamable HTTP（ASGI mount，**不**進 OpenAPI） |
| `/api/v1/mcp/status` | 設定頁連線測試（session 即可） |
| `/api/v1/calendar-share/*` | 公開 hub 代理（見 §6） |
| `/api/v1/access-keys` | 存取金鑰 |
| `/api/v1/events` | SSE |
| `/api/v1/health` | 健康檢查（無鑑權） |

MCP：`{API origin}/api/v1/mcp`，只做 Streamable HTTP。設定範例（OpenClaw）與工具 allowlist 見 [`agent/mcp.md`](agent/mcp.md)。A2A 請求形狀與錯誤碼見 [`agent/a2a.md`](agent/a2a.md)。兩者共用 base tool handlers；MCP **不**在伺服器跑 LLM loop。寫入溯源：`user_events.origin` 為 `mcp` 或 `a2a`（客戶端不可偽造）。

家庭層總開關：`system_config.mcp_enabled`、`a2a_enabled`（預設開，互不控制）。關則對應 HTTP 回 403。同一套 `mcp_cap_*` 過濾 MCP `list_tools`／`call_tool` 與 A2A 內部 tool loop。

## 6. 日曆分享

可選。預設公開 origin：`https://subscribe.devents.tech`（`server/calendar_share/constants.py` `DEFAULT_BASE_URL`）。這是獨立的公開 hub，**不是**本產品的品牌或必裝元件。

本應用只當代理：前端只打 `/api/v1/calendar-share/*`，**不**直連 hub。代理路徑包括 session／timezone／profile、publish（依工作集推／撤）、subscriptions、search。憑證與自動同步間隔存在本機 `system_config`；stamp 7 的 `calendar_share_publish` 不再依賴舊 stamp 的 household auto-sync cache 欄。

對 hub 的流量另有 rate limit；路徑前綴不走一般 `/api/v1` 的部分 HTTP 限制。沒有雙向 CalDAV／OAuth 同步；本機可一次性 ICS 匯入（`/api/v1/calendar/imports/preview`、`/commit`）。

## 7. 桌面連線

Electron `userData/connection.json`（與伺服器讀的 `{DATA_DIR}/connection.json` 同一檔名慣例）：

| 欄位 | 意義 |
|------|------|
| `mode` | `host`（預設：本機跑 API）或 `client`（連 `serverUrl`） |
| `serverUrl` | client 必填；須為 `http`／`https`。無效則回退 host |
| `resetPasswordForLocal` | 預設 `false`。為 `true` 時允許 loopback 走忘記密碼救援；成功後伺服器清回 `false` |

殼層載入 URL：host＋正式 → `localhost:18820`；host＋開發 → Vite；client → `serverUrl`。都會帶 `?desktop=1`。舊的 LAN bind 旗標讀入時丟棄。

## 8. 週期／RRULE

兩條線不要混：

**週期日曆系列**（`recurring_schedules`，編輯在「我的日程」／`/api/v1/calendar/recurring`）：RFC 5545 RRULE 本體（不要 `RRULE:` 前綴）。**僅於查詢時展開**（`GET /api/v1/calendar/window` 與助手／MCP 日曆工具）。**不會觸發 AI 分析**，也不會建立分析排程 job。暫停用 `is_active`；硬刪才拿掉系列列。

**分析任務排程**（`analysis_tasks`，「任務設定」／`/api/v1/tasks`）：具名預設——10 秒、每小時、每日、每週、自訂秒數。內部可能用 RRULE **形狀**的字串給 APScheduler 算下次執行，但那是 trigger 用途，**不會**展開進月曆 window。分析任務沒有「用日曆 RRULE 來排 AI」。

日曆 FREQ 允許 DAILY／WEEKLY／MONTHLY／YEARLY。ICS 匯入走預覽／提交，展開在 Python，不在 React。

## 9. 明確非目標

現行設計不做（或已拿掉）：

- SQLite FTS5／向量 RAG。訊息與情報搜尋是 `LIKE`（標題／內文）。
- MCP stdio、SSE-only 舊傳輸、本機子行程 MCP server。
- 細粒度 access-key scope（能力群組 ≠ 金鑰 scope）。
- 把分析任務、來源、通知、LLM 設定包成 MCP tools。
- A2A 專用 events CRUD、伺服器端多輪 A2A session。
- 應用內 TLS／憑證管理。
- 雙向外部日曆（webcal／CalDAV／OAuth）。一次性 ICS 與可選 hub 代理除外。
- 雲端 STT／本機 Whisper 當預設語音棧。
- 啟動時默默刪庫升級舊 stamp 1–6。

## 10. 相關契約

| 文件 | 內容 |
|------|------|
| [README](../README.md) | 介紹與使用（[简体](../README.zh-Hans.md)、[English](../README.en.md)） |
| [`agent/mcp.md`](agent/mcp.md) | Streamable HTTP、認證、能力群組、工具 allowlist |
| [`agent/a2a.md`](agent/a2a.md) | `POST /api/v1/a2a/agent`、liaison 槽、錯誤碼 |
| [`SECURITY.md`](../SECURITY.md) | 威脅模型與漏洞回報 |
| 本頁其他語 | [简体中文](TECH.zh-Hans.md)、[English](TECH.en.md) |
