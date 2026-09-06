[繁體中文](README.md) | [简体中文](README.zh-Hans.md) | [English](README.en.md)

# <img src="docs/images/logo.png" width="32" height="32" alt=""> Intelligence Monitor

Intelligence Monitor 是給**單一家庭**在自己電腦上用的情報工作站：把日常會看的頻道與信箱收進來，整理成可查的情報與事件，再落到日曆、任務、物品與地圖。它不是多租戶雲端服務。

你可以接 Telegram、Discord、RSS、MQTT、Email 等來源；用分析任務把訊息做成情報事件與排行；在「時間規劃」看月曆與甘特、「任務設定」管監控與分析排程、「物品」管庫存與到期。情報事件頁可切地圖。助手可隨時查問或代為改行程。

資料預設留在本機 SQLite；AI 供應商與金鑰由你自己接。可選把工作集日曆發到公開來源 [https://subscribe.devents.tech](https://subscribe.devents.tech) 讓別人訂閱。

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

1. **取得應用** — 從 [GitHub Releases](https://github.com/Wing9897/im/releases) 安裝 Desktop（Windows／macOS／Linux）。開發或本機跑原始碼：

   ```bash
   uv sync --extra dev --locked
   npm ci
   npm run dev
   ```

2. **首次啟動** — 建立家庭管理員帳號（單一家庭、一組管理員）。Desktop 可選本機當服務（host），或連到已有的遠端伺服器（client）。
3. **登入** — 之後用同一組帳號進入；瀏覽器會拿裝置 session，不必每次貼金鑰。
4. **工作集** — 側欄「工作集」→ 新建，用來歸屬情報、日程與物品。也可先用內建「一般」（`__general__`）。刪掉自建工作集時，底下資料會回到「一般」，「一般」本身不能刪。
5. **來源與情報** — 「來源」接 Telegram、Discord、RSS、MQTT、Email 等；「情報事件」看分析結果（列表／卡片／地圖），「排行榜」看熱門主題。
6. **日曆與任務** — 「時間規劃」看月曆／甘特；「我的日程」管手寫行程與週期系列。「任務設定」是**獨立導航**（`/tasks`），不是工作集底下的分頁，用來設要監控與分析的排程。**週期任務**走獨立排程，**RRULE 僅於查詢時展開**、**不會觸發 AI 分析**。AI 排程支援 10 秒、每小時、每日、每週、自訂秒數。
7. **物品與地圖** — 「物品」管庫存、到期與提醒。情報事件頁可切地圖，把帶座標的事件落在圖上。
8. **助手** — `Ctrl+J`（macOS `⌘+J`）隨時叫出文字輸入；未開輸入時可用「閃現」氣泡看語音／快捷回覆（短暫顯示後消失，可切「持續」）。完整對話與歷史走側欄「助手」。需先在設定接好 AI 供應商。
9. **設定** — 語言、主題、AI 供應商金鑰、通知、外部接口都在設定。帳戶頁可發存取金鑰（MCP／A2A 需 scope `*`）。MCP 總開關與能力群組在 **設定 → 外部接口 → MCP**。
10. **升級舊庫** — 目前是 **schema stamp 7**（`SCHEMA_FLOOR`＝current；生產 `SCHEMA_MIGRATIONS` 為空）。stamp 1–6 **hard-reject**，須備份後 reset。**未來 stamp** 請先**升級應用**。停掉 Desktop／`npm run dev` 後：

    ```bash
    uv run python scripts/reset_local_databases.py --apply
    ```

## 外部 Agent／MCP

任何支援 Streamable HTTP 的外部 Agent 都可連 `{API origin}/api/v1/mcp`（結構化工具，不是聊天）。到帳戶建立 scope `*` 金鑰，再到 **設定 → 外部接口 → MCP** 開總開關與能力群組。OpenClaw 只是其中一種客戶端。契約：[`docs/agent/mcp.md`](docs/agent/mcp.md)。系統總覽：[`docs/TECH.md`](docs/TECH.md)。

要用一句話交辦、由本機選工具，走 A2A（`POST /api/v1/a2a/agent`）：[`docs/agent/a2a.md`](docs/agent/a2a.md)。

## 日曆分享（可選）

日曆分享是可選功能：把工作集日曆發到公開來源，別人用連結或帳號訂閱。

- 公開來源：[https://subscribe.devents.tech](https://subscribe.devents.tech)
- 在本應用：側欄「訂閱」→「日曆分享」，填「服務網址」（預設就是上面這個）並登入，再到「我的發佈」按「發佈工作集」。
- 訂閱者到 hub 用連結或帳號看公開目錄；也可在「搜尋訂閱」加入。本應用不會在瀏覽器裡直連 hub。

## 開發者

```bash
uv sync --extra dev --locked
npm ci
npm run dev
npm run check
```

Python ≥ 3.11、Node.js ≥ 20.19.0。Windows 若 `C:\Windows\System32\` 有 0-byte 的 `node`／`npm` stub，會蓋住真 Node。PR 前跑 `npm run check`（與 CI Ubuntu quality 相同）。`zh-Hant` 為介面文案來源。安全問題走 [`SECURITY.md`](SECURITY.md)，不要開公開 issue。

其餘契約：[`docs/README.md`](docs/README.md)。授權 MIT（[`LICENSE`](LICENSE)）。
