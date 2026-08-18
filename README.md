# Intelligence Monitor

自託管的多源情報監控與 AI 分析桌面工作站——從採集、排程分析、視覺化復盤到自動化動作，全流程在一個應用內完成。

## 功能特色

- **多源採集** — Telegram、Discord、RSS、MQTT、Email (IMAP)，統一入庫與即時 SSE 更新
- **排程 AI 分析** — 統一 trigger-purpose `schedule_rrule`（APScheduler next-run only；FE 預設：10 秒、每小時、每日、每週、自訂秒數 → RRULE）、增量 marker、多 LLM（Ollama / OpenAI / Gemini / OpenRouter）
- **時間規劃** — Timeline 合併分析事件、週期任務（RRULE 僅於查詢時展開、不會觸發 AI 分析）與用戶事件；可在對話框建立一次性／循環日程
- **物品** — `/items` 兩層（分類卡片 → 分類內列表）；數量／單位；到期與提醒走關聯日曆（投影 `source=item_remind`，`itemDateKind=remind`）；無購入日欄位；分類與物品可選 emoji，歸屬工作集
- **工作集** — 任務／事件／物品的歸類標籤（篩選與歸屬維度），不是主導航重做
- **專案調和／網蒐 Agent** — 統一 `analysis_mode=agent`（觸發＋工具／輸出政策；詳情 `/tasks/:taskId/agent`；舊 `/project` 路徑已退役）
- **情報與儀表** — Monitor、Timeline、Leaderboard、Intelligence、可自由排版的畫布
- **助手與提醒** — Agent 自然語言交互；本機通知掃描情報事件與日程
- **本地優先** — SQLite（wipe-only schema；stamp 不符需明確 reset）、憑證加密、本機綁定；Electron 開箱即用

架構與契約細節見 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 核心設計理念

本質是簡潔的 **Input → Process → Output**，三層各自可擴展，中間用任務做統一管理：

| 層 | 角色 | 本專案對應 |
|----|------|------------|
| **Input** | 多源訊號進統一訊息平面 | Collectors（Telegram、Discord、RSS…）→ `messages` |
| **Process** | 篩選、排程、AI 分析 | `analysis_tasks`（`leaderboard`／`intel_event`／`agent`）；循環日程為獨立 `recurring_schedules`（`/api/v1/calendar/recurring`） |
| **Output** | 結果消費與外發 | Intelligence、Timeline、Board、提醒、Actions |

**任務（`analysis_tasks`）是通用接口：** 下游多半以 `taskId` 訂閱，因此來源與顯示方式可持續加，不必各搞一套管線。完整圖表、模式表與例外見 [`docs/ARCHITECTURE.md` Core design](docs/ARCHITECTURE.md#core-design-task-as-universal-interface)。

**Process 路徑差異（prompt／runtime）：**

| 模式 | 執行 | Prompt |
|------|------|--------|
| `leaderboard`／`intel_event` | `execute_batch`（一次性 JSON 分析） | 該任務的 `promptTemplate` 作為 system 主體，再拼共用時間／JSON schema 等尾巴——**各任務可不同** |
| `agent` | `execute_agent_tick`（`AgentTaskSpec`：游標／閾值／定時 + 工具／輸出權限） | 共用 agent system + 政策條款 + **置頂**該任務目標（`promptTemplate`）；cursor 同輪多波連續 session |

循環系列（`recurring_schedules`）不是 analysisMode：查詢時 RRULE 展開，經時間規劃／Schedule 編輯，**不**跑 AI。

Agent／專案調和契約細節：[`docs/agent/agent.md`](docs/agent/agent.md)（URL 僅 `/tasks/:taskId/agent`）。

## 專案結構

目錄職責與樹狀細節見 [`docs/ARCHITECTURE.md` Directory Structure](docs/ARCHITECTURE.md#directory-structure)。文件入口：[`docs/README.md`](docs/README.md)。

## 環境需求

- **Python** >= 3.11
- **Node.js** >= 20.19.0（專案 engine 基線；目前固定使用 Vite 6.4.3，見 `.nvmrc`）
- **npm** (bundled with Node.js)
- **Ollama**（選用，本機 AI 分析 — [ollama.com](https://ollama.com)）

### Windows：PATH 上空的 `node`／`npm` 會遮蔽真 Node

部分環境在 `C:\Windows\System32\` 留下 **0-byte** 的 `node`／`npm` stub。它們常排在 PATH 最前，導致裸跑 `npm`／`node` 全滅，而真正的安裝（例如 `C:\nvm4w\nodejs`）被蓋住。

處理方式（擇一）：

1. **以系統管理員刪除**空的 `C:\Windows\System32\node` 與 `C:\Windows\System32\npm`（以及同目錄下的 `node.exe`／`npm.cmd` 空檔若存在）
2. 或把真實 Node 目錄（如 `nvm4w\nodejs`）**放在 PATH 最前**，再重新開終端機

`npm run dev`（`scripts/dev.mjs`）若偵測到這些空 stub 會印警告，但**不會**代為刪除（需管理員權限）。熱路徑已用 `process.execPath` 啟動 Vite／Electron；若連 `npm` 本身都因 stub 起不來，請先修 PATH。

## 快速開始

```bash
# 安裝依賴（首次）
uv sync --extra dev --locked
npm ci

# 全端開發模式（Server + Vite + Electron）
npm run dev
```

> **Schema stamp 不符／升級後無法啟動？** 本專案是 **wipe-only**（無 in-place migration）。先停掉 `npm run dev`／Electron／獨立 server，再於倉庫根執行：
>
> ```bash
> uv run python scripts/reset_local_databases.py          # dry-run：列出將刪除的檔案
> uv run python scripts/reset_local_databases.py --apply  # 確認後刪除
> ```
>
> 腳本**只**刪已知的 `intelligence_monitor.db` 及其 `-wal`／`-shm`（專案根、Electron userData、`INTELLIGENCE_MONITOR_*` 覆寫路徑等）；**不動** Telegram sessions、`secret.key`、`connection.json`。詳見 [`scripts/reset_local_databases.py`](scripts/reset_local_databases.py) 與下方「資料庫」。

Telegram 來源使用 **StringSession**（`{DATA_DIR}/sessions/{source_id}.session.txt`）。Desktop 與 CLI **共用同一預設資料根**（Windows：`%APPDATA%\Intelligence Monitor`；對齊 Electron `productName`）。可用 `INTELLIGENCE_MONITOR_DATA_DIR` 覆寫。Settings「完全重置」／`POST /system/reset/database` 另會清 sessions、`secret.key`、`connection.json`（比上述腳本更徹底）。

## 指令

以下指令皆可在專案根目錄透過 `npm run` 執行：

### 開發

| 指令 | 說明 |
|------|------|
| `npm run dev` | 全端開發：Server + Vite HMR + Electron |
| `npm run dev:web` | 僅 Server + Vite（不開啟 Electron 視窗） |
| `npm run dev:server` | 僅 Python server（連接埠 18820） |

新增或修改 `web/src/pages/` 下的 UI 時，請優先使用 `web/src/styles/tokens.ts` 中的 `spacing`、`borderRadius`、`typography` 與 `layoutWidth`，避免硬編碼 `padding` / `gap` / `fontSize` 等數值。合規基線由 `web/src/styles/tokenCompliance.test.ts` 守護，遷移後請同步收緊 `VIOLATION_BASELINES`。

### 建置與發佈

| 指令 | 說明 |
|------|------|
| `npm run build` | 建置 Web + Desktop |
| `npm run build:web` | 建置前端靜態檔（`web/dist/`） |
| `npm run build:desktop` | 編譯 Desktop TypeScript |
| `npm run build:server-sidecar` | 以 PyInstaller 打包內建 Python server（**須在目標 OS 上執行**；輸出 `desktop/server-runtime/`；亦為 headless CLI） |
| `npm run package:cli` | 將已建置的 sidecar onedir 打成 `dist/cli/intelligence-monitor-cli-<os>-<arch>.zip`（須先 `build:server-sidecar` 或 `dist:*`） |
| `npm run dist:win` | 封裝 Windows 安裝程式（NSIS .exe；**第一等 Desktop 交付**） |
| `npm run dist:mac` | 封裝 macOS（DMG／zip；**第一等 Desktop 交付**；須在 macOS 上執行） |
| `npm run dist:linux` | 封裝 Linux（AppImage／deb；**第一等 Desktop 交付**；須在 Linux 上執行） |
| `npm run dist:current` | 依本機 OS 封裝（`electron-builder --publish never`） |
| `npm run docker:build` | 建置 server+SPA 容器映像（`intelligence-monitor:local`；與三平台 Desktop 同為第一等交付） |

**CLI** = 無 Electron 的 headless server，與 `python -m server`／`intelligence-monitor`（`pyproject.toml` console script）同一入口；發佈物為各平台 PyInstaller zip（內含 `intelligence-monitor-server`）。

公開商店／企業發佈的 Desktop 建置需對應平台簽章（Windows Authenticode、macOS 公证等）；未簽章建置僅供開發／測試。**發版**：只能由 CI 的 `workflow_dispatch` 明確啟動，才會打包三平台 Desktop + CLI、打 tag、發 GitHub Release 並推 GHCR；PR／`main` push 只跑 quality + build，避免一般合併誤發版。發版流程**不** bot 回寫 `VERSION` 到 `main`。無任何 `v*` tag 時以倉庫 `VERSION` 原樣作為首發（例如 `1.0.0` → `v1.0.0`）；之後依最新 tag 遞增。

### 容器（GHCR）

Server + 建置後 SPA（無 Electron），資料目錄掛載 `/data`：

```bash
docker build -t intelligence-monitor:local .
docker run --rm -p 18820:18820 -v im-data:/data intelligence-monitor:local
# 或
docker compose up --build
```

CI 只在明確執行 **`workflow_dispatch`** 發版時推送到 `ghcr.io/<owner>/<repo>`（需 packages:write）。`Dockerfile` 含 healthcheck；發佈 job 另做一次 deploy smoke。

### 測試

| 指令 | 說明 |
|------|------|
| `npm test` | 根目錄 smoke、掃描與安全測試（xss、無障礙、建置） |
| `npm run test:server` | Python 測試（pytest） |
| `npm run test:web` | 前端測試（vitest） |
| `npm run test:desktop` | Desktop 測試（vitest） |
| `npm run test:all` | 依序執行所有測試套件，避免跨套件資源爭用 |

### 驗證腳本對照（日常 CI／部署後／發行）

| 場景 | 指令 | 說明 |
|------|------|------|
| **日常 CI**（PR／main） | `npm run check` + `npm run build` | GitHub 上 **`quality`**（Ubuntu）：lint、漂移檢查、型別、`test:all`、web／desktop 建置 |
| **部署後 live**（需運行中 server） | `npm run verify:deploy` | 短 live 檢查（`scripts/smoke.py`）；已註冊 admin 時需 `VERIFY_BEARER`／`IM_ACCESS_TOKEN` |
| **發行／打包** | `dist:*` + `verify:desktop:full` + `package:cli` | 僅 **`workflow_dispatch`**：三平台 Desktop + CLI → tag + GitHub Release + GHCR |

| 指令 | 說明 | 典型耗時 |
|------|------|----------|
| `npm run verify:deploy` | 對 `127.0.0.1:18820` 的短部署後驗證（`smoke` 為別名） | ~3s |
| `npm run verify:desktop:fast` | 自動 build，再跑 Desktop vitest + 建置路徑檢查 | ~40–90s |
| `npm run verify:desktop:full` | 發佈產物檢查（`desktop_verify` full；**不含** vitest）；先執行對應 `dist:*` | ~5–15s（不含打包） |

### 營運與報表

| 指令 | 說明 |
|------|------|
| `npm run stats` | 專案統計（路由數、模組行數等；`uv run python scripts/project_stats.py`） |

### 程式碼品質

| 指令 | 說明 |
|------|------|
| `npm run check` | 完整本機關卡，依序執行並在第一個失敗處停下：lint → `sync:presets:check` → `i18n:check` → `openapi:check` → 型別檢查 → 所有測試（server、web、desktop、根目錄） |
| `npm run lint` | Ruff（server／Python scripts）+ ESLint（web／desktop／`scripts/*.mjs`） |
| `npm run lint:server` | Python lint + 格式檢查 |
| `npm run lint:web` | 前端 ESLint |
| `npm run typecheck` | Web、Desktop、Python server 與 `scripts/` 型別檢查 |
| `npm run typecheck:server` | Python 型別檢查（Pyright basic：`server/` + `scripts/`） |

> **發佈或重大變更前**，請執行 `npm run check`。

### 清理

| 指令 | 說明 |
|------|------|
| `npm run clean` | 清除建置產物與快取 |

## 版本控制

### CI（`.github/workflows/ci.yml`）

| 觸發 | 行為 |
|------|------|
| **PR** | 只跑 `quality` |
| **push `main`** | 只跑 `quality`（含 build），不打包、不推 tag、不發 Release |
| **`workflow_dispatch`** | `quality` → `version`（from tags；無 tag 用 `VERSION` 原樣）→ 三平台 `package`（Desktop+CLI；`desktop_verify` only）→ **只 push tag** + GitHub Release → GHCR |

**版本權威（勿混用）：**
- **產品 SemVer** = **git tags**（`v*`）／GitHub Release
- **schema stamp**（`PRAGMA user_version`）與公開 **`SCHEMA_SEMVER`** = SQLite wipe-only 契約，**不必**等於產品 tag
- 根目錄 **`VERSION`** = 本機／展示／打包注入用，可能落後 tag；CI **不會** bot commit／push 回寫到 main

每次手動發版 bump（已有 `v*` tag 時）：`X.Y.Z-beta.N` → `N+1`；`X.Y.Z` → patch +1（`scripts/bump_version.py --from-tags --print-only`）。**無任何 `v*` tag 時不 bump**，直接用 `VERSION` 原樣作為首發。打包時把算出的版本注入工作區（不改分支歷史）。本機若要對齊檔案：`python scripts/bump_version.py --from-tags --write` 再 `npm run sync:version`（預設不寫盤）。

一句話：**PR／main 只做 quality + build；明確執行 `workflow_dispatch` 才會按 tag 版本打包三平台 Desktop+CLI、打 tag、發 Release——不改 main 歷史；stamp／SCHEMA_SEMVER 另軌。**

本機關卡：`npm run check`；Desktop 改動可另跑 `npm run build && npm run verify:desktop:fast`。

## 設定

執行期設定存於資料庫（`system_config` 表）。AI 供應商（Ollama / OpenAI / Gemini / OpenRouter）、模型、分析並發數與資料保留由 UI **Settings** 管理；**API 金鑰**（Webhook／自動化／A2A；可選 scopes）在 **帳戶 → API 金鑰**（`/account/keys`）產生與撤銷。

環境變數僅用於部署接線：

| 變數 | 用途 |
|------|------|
| `INTELLIGENCE_MONITOR_DB` | SQLite 路徑（預設：`{DATA_DIR}/intelligence_monitor.db`） |
| `INTELLIGENCE_MONITOR_DATA_DIR` | 本機資料根（DB／`secret.key`／`sessions/`／`connection.json`）。Desktop → Electron userData；CLI 預設與 packaged Desktop 相同（Win：`%APPDATA%\Intelligence Monitor`） |
| `INTELLIGENCE_MONITOR_SESSIONS_DIR` | 可選；覆寫 Telegram sessions 目錄（預設：`{DATA_DIR}/sessions`） |
| `INTELLIGENCE_MONITOR_HOST` | Server 綁定 host（預設：`0.0.0.0`；可覆寫為特定網卡 IP） |
| `INTELLIGENCE_MONITOR_SECRET_KEY_FILE` | 加密金鑰檔路徑（由 desktop shell 自動設定；未設時為 `{DATA_DIR}/secret.key`） |
| `IM_FRONTEND_DIST` | 建置後前端靜態檔路徑（由 desktop shell 自動設定） |

### 驗證（授權）

兩套憑證並存（`verify_auth` 擇一即可）：

| 用途 | 憑證 | 何處取得 |
|------|------|----------|
| 日常 UI／SSE | 裝置 session（access + refresh） | 人帳密註冊／登入後由服務簽發 |
| Webhook／腳本／自動化／A2A | 長效 API 金鑰（`*` 完整，或 `read` 只讀） | **帳戶 → API 金鑰**（非 UI 登入憑證） |

- **新安裝**：`localhost_auth_exempt` 預設為 true，僅便於本機首次 `POST /api/v1/setup/register`。
- **註冊／登入之後**：設為 `false`；**本機 loopback 也不再豁免**——與遠端一樣須帶有效 Bearer（裝置 access 或 API 金鑰）。
- **LAN**：服務預設綁定 `0.0.0.0`（區網可連；仍須登入／憑證）。開防火牆放行 `18820`。瀏覽器／桌面用同一組 admin 帳密登入取得裝置 session；Webhook／腳本／A2A 另用可撤銷 API 金鑰（`*` 完整，或 `read` 只讀）。僅區網使用不需要 TLS；**經 port-forward 暴露到公網時，必須在前面加 Caddy／Nginx 等 TLS 反代**——應用本身不終止 HTTPS。
- **忘碼**：預設關閉。須先用具寫入權限的系統帳號把資料目錄 `connection.json` 的 `resetPasswordForLocal` 設為 `true`，之後才能由 loopback 呼叫 `POST /api/v1/setup/reset-password`（不需舊密碼）；成功後該旗標自動關回 `false`（一次性）。詳見下方 [Desktop host vs client](#desktop-host-vs-client) 與 [`docs/AUTH.md`](docs/AUTH.md)。

#### Live verify 必設：`VERIFY_BEARER`／`IM_ACCESS_TOKEN`

`npm run verify:deploy`（`scripts/smoke.py`）在**已註冊 admin** 的庫上必須帶 Bearer，否則受保護 API 會 401（腳本會 fail-fast 並提示）：

```bash
# PowerShell 範例（擇一；值為裝置 access token 或 scope=* 的 API 金鑰）
$env:VERIFY_BEARER = "<token>"
# 或
$env:IM_ACCESS_TOKEN = "<token>"

npm run verify:deploy
```

權威細節與完整手動清單見 [`docs/AUTH.md`](docs/AUTH.md)／[Manual verification checklist](docs/AUTH.md#manual-verification-checklist)（SoT）。

### 首次設定流程（摘要）

1. 開啟 Desktop（host）或瀏覽器連到 Server。
2. **純 Web**：已連到目標 origin；未有 admin → 本機註冊；已有 admin → 帳密登入（無配對碼）。
3. **Desktop**：仍選「這台電腦 / 其他裝置」僅決定連線目標；host 本機註冊，client 填 Server URL 後用帳密登入。CLI **不再**印 Pairing code。

### 手動驗證清單

- [ ] Desktop host：首次 Local 註冊後，未帶 token 的本機 API 回 401；持 access 可進 App
- [ ] 登出 → 密碼再登；改密碼；loopback 忘碼重置；LAN 第二裝置同帳密登入
- [ ] Webhook／腳本／A2A：用完整 scope（`*`）**API 金鑰** 以 `Authorization: Bearer` 打業務 API（含 `POST /api/v1/a2a/agent`）；只讀金鑰（`read`）不可寫入或呼叫 A2A
- [ ] Profile 登出 → 回到登入；Desktop client 登出後外殼回到 host
- [ ] 已登入狀態下本地 STT／本機通知行為與既有一致
- [ ] `python -m server` 啟動時**不**印 Pairing code

## 架構

Electron 外殼（`desktop/`）預設以 **host** 模式啟動內建 Python FastAPI server（`server/`），並載入 React SPA（`web/`）。前端經 HTTP／SSE 與同一行程內的採集、排程分析、動作與 SQLite 互動。元件、資料流與任務中心設計見 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

### Desktop host vs client

連線模式寫在 Electron `userData/connection.json`：`{ "mode": "host" | "client", "serverUrl"?: "http://…", "resetPasswordForLocal"?: false }`。本機「忘記密碼」預設關閉；用具寫入權限的系統帳號把 `resetPasswordForLocal` 設為 `true` 後重新整理登入頁即可救援（成功後自動改回 `false`）。

| 模式 | 行為 |
|------|------|
| **host**（預設） | 正式版啟動 sidecar；UI 載入 `http://localhost:18820/?desktop=1`（開發：Vite `1420`） |
| **client** | 不起 sidecar；UI 載入 `serverUrl`（附加 `?desktop=1`）；分析通知 SSE 也連該遠端 |

切換模式：FirstRunWizard／Profile 經 preload `window.electronConnection`（`getConnection` / `setConnection` / `restartShell`）寫入後重啟外殼。遠端載入失敗時會記錄日誌並自動重試；可改回 host 或修正 `serverUrl` 後再 `restartShell`。

### 資料庫

SQLite 單檔（預設 `{DATA_DIR}/intelligence_monitor.db`；Desktop／CLI 共用同一資料根）。權威 DDL 為 **schema v40**（`server/db/schema_domains/` 按域宣告，由 `server/db/schema.py` 聚合；公開 `schemaSemver` = `0.1.0-beta.41`）——**全部** DB 枚舉 CHECK（provider／staff_class／json_mode／web_search_provider、calendar kind／direction／origin、timeline `source`、action_type／各 status、trigger_mode、analysis_time_range、log level、analysis_strategy_mode、`notify_pref`）由 `server/domain/` Python SoT 生成並配 drift 測試；`notify_pref` 為 `follow`／`off`；`worksets.notify_enabled`／`external_enabled` 默認開（工作集頁樞紐；內建「一般」兩檔都可關）；`user_events`／`recurring_schedules` 的 `item_id` 為真 FK（`ON DELETE SET NULL`）；`user_events.origin` 含 `mcp`（MCP 工具通道）；`llm_profiles`／`llm_staff_instances` 取代全域／`assistant_llm_*` 雙路徑 LLM 設定；任務必填 `llm_profile_id`；新鮮庫**不**再種子預設 Ollama `__default__`；任務／助手需完整可用設定檔（助手／A2A／任務顧問走硬綁定全局槽）；`recurring_schedules` 是獨立日曆系列；物品到期 derive-on-read；時間軸投影 `source=item_remind`；並保留 fingerprint 驗證與顯式 reset。新安裝直接建 stamp-40 庫。

**Wipe-only：** v1–v39 與任何其他非空 stamp／fingerprint 不符時啟動 hard-reject，**沒有** in-place migration 或自動刪庫；須自行備份後 reset。stamp／`SCHEMA_SEMVER` 只描述 DB 契約，**與**產品 git tag **解耦**。

```bash
uv run python scripts/reset_local_databases.py --apply
```

版本政策、支援矩陣與 wipe-floor 規則的唯一真相源在 [`docs/SCHEMA-BASELINE.md`](docs/SCHEMA-BASELINE.md)（[support matrix](docs/SCHEMA-BASELINE.md#schema-support-matrix)／[explicit reset](docs/SCHEMA-BASELINE.md#schema-v38-explicit-reset)）。文件索引：[`docs/README.md`](docs/README.md)。

本機手動 UI 種子（**dev-only**，非 CI／產品路徑）：`uv run python scripts/seed_calendar_ui_fixtures.py`、`uv run python scripts/seed_dev_items_calendar.py`、`uv run python scripts/seed_items_finance_demo.py`（見 [`ARCHITECTURE.md` Scripts](docs/ARCHITECTURE.md#scripts-scripts)）。

### 連接埠

| 服務 | 連接埠 | 備註 |
|------|--------|------|
| Python Server | 18820 | REST API + SSE + 靜態檔 |
| Vite Dev Server | 1420 | 僅開發用，代理 `/api` → 18820 |

## 文件

| 文件 | 內容 |
|------|------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 系統架構；[Core design](docs/ARCHITECTURE.md#core-design-task-as-universal-interface)、[Schema matrix](docs/SCHEMA-BASELINE.md#schema-support-matrix)、[API contract](docs/ARCHITECTURE.md#api-contract)、[Ops board](docs/ARCHITECTURE.md#ops-board)、[Frontend layers](docs/ARCHITECTURE.md#frontend-layering) |
| [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md) | 有意差異／quirks；契約細節見 ARCHITECTURE／`docs/agent/*` |
| [`docs/I18N-GLOSSARY.md`](docs/I18N-GLOSSARY.md) | UI 用語／error_code 詞彙表 |
| [`docs/agent/assistant.md`](docs/agent/assistant.md) | 內建助手（Agent + 瀏覽器語音）使用與契約 |
| [`docs/agent/a2a.md`](docs/agent/a2a.md) | 客戶經理（Agent-to-Agent / Account manager）：自然語言 `POST /api/v1/a2a/agent`（events CRUD 門面已移除） |
| [`docs/agent/agent.md`](docs/agent/agent.md) | Agent／專案調和 tick：空佇列跳過、多波抽乾、連續 session、置頂目標；agent 無 items 寫入；URL 僅 `/tasks/:taskId/agent` |
| [`docs/diagrams/README.md`](docs/diagrams/README.md) | Mermaid 結構圖：Input → Process → Output、排程、Agent 閉環 |
| [`desktop/resources/README.md`](desktop/resources/README.md) | 封裝用圖示說明 |

漂移檢查：`npm run check`、`npm run verify:deploy`、`server/tests/test_contract_*.py`、`server/tests/test_dead_endpoints.py`。

## 授權

本專案採用 **MIT License**，完整條文見 [`LICENSE`](LICENSE)。

安全性政策與漏洞回報方式見 [`SECURITY.md`](SECURITY.md)；貢獻流程與門禁指令見 [`CONTRIBUTING.md`](CONTRIBUTING.md)。
