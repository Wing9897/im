[繁體中文](README.md) | [简体中文](README.zh-Hans.md) | [English](README.en.md)

# <img src="docs/images/logo.png" width="32" height="32" alt=""> Intelligence Monitor

本機優先的家庭情報工作站：把 Telegram、Discord、RSS、MQTT、Email 等來源收進來，用 AI 整理成情報與事件，再落到日曆、任務、物品與地圖。助手可隨時查問或代為改行程。

## 畫面

![月曆與當日行程側欄](docs/images/schedule_calendar.png)

月曆與當日行程。

![AI 員工介紹](docs/images/AIstaff_introduce.png)

助手、客戶經理與後勤分析角色。

![助手對話](docs/images/chat_page.png)

與助手對話、查情報或改日程。

![情報地圖](docs/images/intelligence_map.png)

情報事件落在地圖上。

![物品庫存](docs/images/item.png)

物品庫存與到期。

![分析任務](docs/images/mission.png)

分析任務與監控設定。

## 實際使用

1. **下載或本機跑** — 從 [GitHub Releases](https://github.com/Wing9897/im/releases) 安裝 Desktop（Windows／macOS／Linux）。開發則：

   ```bash
   uv sync --extra dev --locked
   npm ci
   npm run dev
   ```

2. **首次啟動** — 建立家庭管理員帳號。Desktop 可選本機服務，或連到已有的遠端伺服器。
3. **登入** — 之後用同一組帳號進入。
4. **建立工作集** — 側欄「工作集」→ 新建，用來歸屬情報、日程與物品（也可先用內建「一般」）。
5. **加來源／情報** — 「來源」接 Telegram、Discord、RSS、MQTT、Email 等；情報頁看事件與排行。
6. **日曆與任務** — 「時間規劃」看月曆／甘特；「任務設定」設要監控與分析的排程。**週期任務**走獨立排程，**RRULE 僅於查詢時展開**、**不會觸發 AI 分析**。AI 排程支援 10 秒、每小時、每日、每週、自訂秒數。
7. **助手** — `Ctrl+J`（macOS `⌘+J`）隨時叫出，或開助手頁。需先在設定接好 AI 供應商。
8. **設定** — 語言、AI、通知、外部接口都在設定。帳戶頁可發存取金鑰。

升級後若舊庫無法啟動：目前是 **schema stamp 7**（`SCHEMA_FLOOR`＝current；生產 `SCHEMA_MIGRATIONS` 為空）。stamp 1–6 **hard-reject**，須備份後 reset。**未來 stamp** 請先**升級應用**。停掉 Desktop／`npm run dev` 後：

```bash
uv run python scripts/reset_local_databases.py --apply
```

## 外部 Agent／MCP

任何支援 Streamable HTTP 的外部 Agent 都可連 `{API origin}/api/v1/mcp`（結構化工具，不是聊天）。到帳戶建立 scope `*` 金鑰，再到 **設定 → 外部接口 → MCP** 開總開關與能力群組。OpenClaw 只是其中一種客戶端。契約：[`docs/agent/mcp.md`](docs/agent/mcp.md)。

要用一句話交辦、由本機選工具，走 A2A（`POST /api/v1/a2a/agent`）：[`docs/agent/a2a.md`](docs/agent/a2a.md)。

## 日曆分享（可選）

公開 hub：**https://subscribe.devents.tech**。本應用只經 `/api/v1/calendar-share/*` 代理，前端不直連。

## 開發者

```bash
uv sync --extra dev --locked
npm ci
npm run dev
npm run check
```

Python ≥ 3.11、Node.js ≥ 20.19.0。Windows 若 `C:\Windows\System32\` 有 0-byte 的 `node`／`npm` stub，會蓋住真 Node。PR 前跑 `npm run check`（與 CI Ubuntu quality 相同）。`zh-Hant` 為介面文案來源。安全問題走 [`SECURITY.md`](SECURITY.md)，不要開公開 issue。

其餘契約：[`docs/README.md`](docs/README.md)。授權 MIT（[`LICENSE`](LICENSE)）。
