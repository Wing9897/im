# Intelligence Monitor

自託管的多源情報監控與 AI 分析桌面工作站——從採集、排程分析、視覺化復盤到自動化動作，全流程在一個應用內完成。

## 功能特色

> 🏗️ Input→Process→Output · 🎯 任務中心 · ✍️ Prompt 規則化 · 🏠 本地隱私 · 📡 文字與 IoT 同源

完整封面式介紹（含擴展來源、AI 員工、助手、儀表板、資訊過濾、事件提醒等）：  
**[`docs/功能特色.md`](docs/功能特色.md)**

- **多源採集** — Telegram、Discord、RSS、MQTT、Email (IMAP)，統一入庫與即時 SSE 更新
- **排程 AI 分析** — interval/cron 計時器（10 秒、每小時、每日、每週、自訂秒數）、增量 marker、多 LLM（Ollama / OpenAI / Gemini / OpenRouter）
- **循環任務** — Recurring task（`analysis_mode=recurring`）；RRULE 僅於查詢時展開，不會觸發 AI 分析
- **專案** — `project` 閉環多波消化來源積壓
- **情報與儀表** — Monitor、Timeline、Leaderboard、Intelligence、可自由排版的 Ops Board
- **助手與提醒** — Agent 自然語言交互；語音提醒掃描關鍵事件與日程
- **本地優先** — SQLite、憑證加密、本機綁定；Electron 開箱即用

## 核心設計理念

本質是簡潔的 **Input → Process → Output**，三層各自可擴展，中間用任務做統一管理：

| 層 | 角色 | 本專案對應 |
|----|------|------------|
| **Input** | 多源訊號進統一訊息平面 | Collectors（Telegram、Discord、RSS…）→ `messages` |
| **Process** | 篩選、排程、AI／非 AI 分析 | `analysis_tasks`（`leaderboard`／`event`／`recurring`／`calendar_task`／`project`） |
| **Output** | 結果消費與外發 | Intelligence、Timeline、Board、提醒、Actions |

**任務（`analysis_tasks`）是通用接口：** 下游多半以 `taskId` 訂閱，因此來源與顯示方式可持續加，不必各搞一套管線。完整圖表、模式表與例外見 [`docs/ARCHITECTURE.md` Core design](docs/ARCHITECTURE.md#core-design-task-as-universal-interface)。

**Process 路徑差異（prompt／runtime）：**

| 模式 | 執行 | Prompt |
|------|------|--------|
| `leaderboard`／`event` | `execute_batch`（一次性 JSON 分析） | 該任務的 `promptTemplate` 作為 system 主體，再拼共用時間／JSON schema 等尾巴——**各任務可不同** |
| `project` | `execute_project_tick`（多波 Agent 工具閉環） | 共用 project system + **置頂**該任務目標（`promptTemplate`）；同輪多波連續 session，跨輪排程開新對話 |
| `recurring`／`calendar_task` | 不跑 AI 分析 | — |

專案 tick 契約細節：[`docs/agent/project.md`](docs/agent/project.md)。

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

若要**空庫起跑**（刪除本地歷史資料），先停止 dev 再執行：

```bash
python scripts/reset_local_databases.py --apply
```

會刪除專案根與 Electron userData 下的 `intelligence_monitor.db`、schema bak、Telegram sessions、`secret.key`、以及 `connection.json`。詳見 [`scripts/reset_local_databases.py`](scripts/reset_local_databases.py)。

Telegram 帳號使用 **StringSession**（`{DATA_DIR}/sessions/{account_id}.session.txt`）。Desktop 與 CLI **共用同一預設資料根**（Windows：`%APPDATA%\Intelligence Monitor`；對齊 Electron `productName`）。可用 `INTELLIGENCE_MONITOR_DATA_DIR` 覆寫。全量／資料庫 reset（或 `python scripts/reset_local_databases.py --apply`）會刪除 `*.session.txt`、殘留 `*.session`、`secret.key`、`connection.json`。

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
| `npm run build:server-sidecar` | 以 PyInstaller 打包內建 Python server（**須在目標 OS 上執行**；輸出 `desktop/server-runtime/`） |
| `npm run dist:win` | 封裝 Windows 安裝程式（NSIS .exe） |
| `npm run dist:mac` | 封裝 macOS（DMG／zip；CI 預設未簽章） |
| `npm run dist:linux` | 封裝 Linux（AppImage／deb） |
| `npm run dist:current` | 依本機 OS 封裝（`electron-builder --publish never`） |
| `npm run docker:build` | 建置 server+SPA 容器映像（`intelligence-monitor:local`） |

公開商店／企業發佈的 Desktop 建置需各平台簽章（Windows Authenticode、Apple notarization 等）；未簽章建置僅供開發／測試。容器映像推送到 **GHCR**（見下方 CI）。

### 容器（GHCR）

Server + 建置後 SPA（無 Electron），資料目錄掛載 `/data`：

```bash
docker build -t intelligence-monitor:local .
docker run --rm -p 18820:18820 -v im-data:/data intelligence-monitor:local
# 或
docker compose up --build
```

CI 在 `main` push、`v*` tag、或手動 `workflow_dispatch` 時推送到 `ghcr.io/<owner>/<repo>`（需 packages:write；映像預設跟隨 repo 可見性）。

### 測試

| 指令 | 說明 |
|------|------|
| `npm test` | 根目錄 smoke、掃描與安全測試（xss、無障礙、建置） |
| `npm run test:server` | Python 測試（pytest） |
| `npm run test:web` | 前端測試（vitest） |
| `npm run test:desktop` | Desktop 測試（vitest） |
| `npm run test:all` | 平行執行所有測試套件 |

### 驗證腳本對照（日常 CI／本機 live／發行）

| 場景 | 指令 | 說明 |
|------|------|------|
| **日常 CI**（push／PR） | `npm run check` | lint + 漂移檢查（presets／i18n／OpenAPI）+ 型別檢查 + `test:all`；矩陣：Windows／Ubuntu／macOS；另建置 web／desktop／各 OS sidecar |
| **本機 live**（需運行中 server） | `npm run verify:fast`／`verify:full`／`verify:operational` | 對 `127.0.0.1:18820` 的 API／營運檢查；多數不進 CI |
| **發行／打包後** | `npm run dist:win`／`dist:mac`／`dist:linux` + `npm run verify:desktop:full` | 當前 OS 的 sidecar、unpacked、安裝產物；CI 在手動 dispatch／`v*` tag 跑三平台 package，並推 GHCR |

| 指令 | 說明 | 典型耗時 |
|------|------|----------|
| `npm run verify:fast` | Smoke + API 回歸評估（不含即時 Gemini batch） | ~3s |
| `npm run verify:full` | `verify:fast` + 對運行中 server 的營運 API 檢查 | ~30s–3min |
| `npm run verify:operational` | 僅營運 API 檢查（需 server 在 `127.0.0.1:18820`） | ~30s–3min |
| `npm run verify:desktop:fast` | 日常 Desktop vitest + Web/Desktop 建置路徑檢查；先執行 `npm run build` | ~5–15s |
| `npm run verify:desktop:full` | 發佈檢查：fast + 當前 OS 的 sidecar／unpacked／安裝產物；先執行對應 `dist:win`／`dist:mac`／`dist:linux` | ~5–15s（不含打包） |

### 營運與報表

| 指令 | 說明 |
|------|------|
| `npm run report:pending-batches` | 列出仍為 `pending` 的分析批次（需運行中 server） |
| `npm run stats` | 專案統計（路由數、模組行數等；`uv run python scripts/project_stats.py`） |

`verify:full` 預期 server 在 `http://127.0.0.1:18820`。Batch 輪詢上限與嚴格模式等環境變數說明見 [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md#operational-verify)。

### 程式碼品質

| 指令 | 說明 |
|------|------|
| `npm run check` | 完整本機關卡，依序執行並在第一個失敗處停下：lint → `sync:presets:check` → `i18n:check` → `openapi:check` → 型別檢查 → 所有測試（server、web、desktop、根目錄） |
| `npm run lint` | Ruff（server）+ ESLint（web） |
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

GitHub Actions 會在 push 與 pull request 時於 **Windows／Ubuntu／macOS** 執行品質關卡與一般建置。手動 `workflow_dispatch` 或推送 `v*` tag 時另建置三平台 Desktop 產物並上傳 artifact；`main`／tag／dispatch 另建置並推送 **GHCR** 容器映像。本機請維持相同關卡：

| 時機 | 指令 |
|------|------|
| 日常開發 | `npm run verify:fast`；Desktop 改動另跑 `npm run build && npm run verify:desktop:fast` |
| 發佈前 | `npm run check`、對應平台 `npm run dist:*`、`npm run verify:desktop:full`；容器可 `npm run docker:build`（live operational 可另跑 `verify:full`，server 需在 `127.0.0.1:18820`） |

## 設定

執行期設定存於資料庫（`system_config` 表）。AI 供應商（Ollama / OpenAI / Gemini / OpenRouter）、模型、分析並發數與資料保留由 UI **Settings** 管理；**API 金鑰**（Webhook／自動化／A2A；可選 scopes）在 **帳戶 → API 金鑰**（`/account/keys`）產生與撤銷。

環境變數僅用於部署接線：

| 變數 | 用途 |
|------|------|
| `INTELLIGENCE_MONITOR_DB` | SQLite 路徑（預設：`{DATA_DIR}/intelligence_monitor.db`） |
| `INTELLIGENCE_MONITOR_DATA_DIR` | 本機資料根（DB／`secret.key`／`sessions/`／`connection.json`）。Desktop → Electron userData；CLI 預設與 packaged Desktop 相同（Win：`%APPDATA%\Intelligence Monitor`） |
| `INTELLIGENCE_MONITOR_SESSIONS_DIR` | 可選；覆寫 Telegram sessions 目錄（預設：`{DATA_DIR}/sessions`） |
| `INTELLIGENCE_MONITOR_HOST` | Server 綁定 host（預設：`127.0.0.1`；容器映像設為 `0.0.0.0`） |
| `INTELLIGENCE_MONITOR_SECRET_KEY_FILE` | 加密金鑰檔路徑（由 desktop shell 自動設定；未設時為 `{DATA_DIR}/secret.key`） |
| `IM_FRONTEND_DIST` | 建置後前端靜態檔路徑（由 desktop shell 自動設定） |

### 驗證（授權）

兩套憑證並存（`verify_auth` 擇一即可）：

| 用途 | 憑證 | 何處取得 |
|------|------|----------|
| 日常 UI／SSE | 裝置 session（access + refresh） | 人帳密註冊／登入後由服務簽發 |
| Webhook／腳本／自動化／A2A | 長效 API 金鑰（`*` 或 `a2a:agent`） | **帳戶 → API 金鑰**（非 UI 登入憑證） |

- **新安裝**：`localhost_auth_exempt` 預設為 true，僅便於本機首次 `POST /api/v1/setup/register`。
- **註冊／登入之後**：設為 `false`；**本機 loopback 也不再豁免**——與遠端一樣須帶有效 Bearer（裝置 access 或 API 金鑰）。
- **LAN**：預設只綁 `127.0.0.1`。要讓區網其他裝置連入，設定 `INTELLIGENCE_MONITOR_HOST=0.0.0.0`（或具體網卡 IP）並開防火牆放行 `18820`；瀏覽器／桌面用同一組 admin 帳密登入取得裝置 session；Webhook／腳本／A2A 另用 API 金鑰（`*` 或 `a2a:agent`）。
- **忘碼**：僅 loopback 可 `POST /api/v1/setup/reset-password`（不需舊密碼）。

#### Live verify 必設：`VERIFY_BEARER`／`IM_ACCESS_TOKEN`

`npm run verify:fast`／`verify:full`／`verify:operational`、以及 `scripts/smoke.py`／`api_regression_eval.py`／`operational_verify.py`，在**已註冊 admin** 的庫上必須帶 Bearer，否則受保護 API 會 401（腳本會 fail-fast 並提示）：

```bash
# PowerShell 範例（擇一；值為裝置 access token 或 scope=* 的 API 金鑰）
$env:VERIFY_BEARER = "<token>"
# 或
$env:IM_ACCESS_TOKEN = "<token>"

npm run verify:fast
```

權威細節與完整手動清單見 [`docs/ARCHITECTURE.md` Authentication](docs/ARCHITECTURE.md#authentication)／[Manual verification checklist](docs/ARCHITECTURE.md#manual-verification-checklist)（SoT）。

### 首次設定流程（摘要）

1. 開啟 Desktop（host）或瀏覽器連到 Server。
2. **純 Web**：已連到目標 origin；未有 admin → 本機註冊；已有 admin → 帳密登入（無配對碼）。
3. **Desktop**：仍選「這台電腦 / 其他裝置」僅決定連線目標；host 本機註冊，client 填 Server URL 後用帳密登入。CLI **不再**印 Pairing code。

### 手動驗證清單

- [ ] Desktop host：首次 Local 註冊後，未帶 token 的本機 API 回 401；持 access 可進 App
- [ ] 登出 → 密碼再登；改密碼；loopback 忘碼重置；LAN 第二裝置同帳密登入
- [ ] Webhook／腳本：用完整 scope（`*`）**API 金鑰** 以 `Authorization: Bearer` 打業務 API；A2A 用 `a2a:agent` 金鑰打 `POST /api/v1/a2a/agent`
- [ ] Profile 登出 → 回到登入；Desktop client 登出後外殼回到 host
- [ ] 已登入狀態下本地 STT／語音提醒行為與既有一致
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

SQLite 單檔（預設 `{DATA_DIR}/intelligence_monitor.db`；Desktop／CLI 共用同一資料根）。權威 DDL 為 **schema v3**（`server/db/schema_ddl.py`；公開 `schemaSemver` = `0.1.0-beta.3`）；新安裝直接建 stamp-3 庫（wipe-floor，`SCHEMA_MIGRATIONS` 為空）。**更舊 stamp（含 v1–v2 與 legacy 4–24）一律 hard-reject**、拒絕啟動，無 in-place 升級路徑。需明確 reset 後重新收集：

```bash
python scripts/reset_local_databases.py --apply
```

版本政策、支援矩陣與升級門檻的唯一真相源在 [`ARCHITECTURE.md` Schema support matrix](docs/ARCHITECTURE.md#schema-support-matrix)。文件索引：[`docs/README.md`](docs/README.md)。

### 連接埠

| 服務 | 連接埠 | 備註 |
|------|--------|------|
| Python Server | 18820 | REST API + SSE + 靜態檔 |
| Vite Dev Server | 1420 | 僅開發用，代理 `/api` → 18820 |

## 文件

| 文件 | 內容 |
|------|------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 系統架構；[Core design](docs/ARCHITECTURE.md#core-design-task-as-universal-interface)、[Schema matrix](docs/ARCHITECTURE.md#schema-support-matrix)、[API contract](docs/ARCHITECTURE.md#api-contract)、[Ops board](docs/ARCHITECTURE.md#ops-board)、[Frontend layers](docs/ARCHITECTURE.md#frontend-layering) |
| [`docs/KNOWN-SIMPLIFICATIONS.md`](docs/KNOWN-SIMPLIFICATIONS.md) | 有意差異／quirks；契約細節見 ARCHITECTURE／`docs/agent/*` |
| [`docs/I18N-GLOSSARY.md`](docs/I18N-GLOSSARY.md) | UI 用語／error_code 詞彙表 |
| [`docs/agent/assistant.md`](docs/agent/assistant.md) | 內建助手（Agent + 瀏覽器語音）使用與契約 |
| [`docs/agent/a2a.md`](docs/agent/a2a.md) | 客戶經理（Agent-to-Agent / Account manager）：自然語言 `POST /api/v1/a2a/agent`（events CRUD 門面已移除） |
| [`docs/agent/project.md`](docs/agent/project.md) | 專案管理 tick：空佇列跳過、多波抽乾、連續 session、置頂目標 |
| [`docs/diagrams/README.md`](docs/diagrams/README.md) | Mermaid 結構圖：Input → Process → Output、排程、專案閉環 |
| [`desktop/resources/README.md`](desktop/resources/README.md) | 封裝用圖示說明 |

漂移檢查：`npm run check`、`npm run verify:fast`、`server/tests/test_contract_*.py`、`server/tests/test_dead_endpoints.py`。

## 授權

本專案採用 **MIT License**，完整條文見 [`LICENSE`](LICENSE)。

安全性政策與漏洞回報方式見 [`SECURITY.md`](SECURITY.md)；貢獻流程與門禁指令見 [`CONTRIBUTING.md`](CONTRIBUTING.md)。
