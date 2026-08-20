# I18N Glossary（用語定稿）

本文件鎖定產品用語，供 UI／測試／翻譯對照。正式 i18n 已引入 **react-i18next** + **i18next**。

## 模組結構（`web/src/i18n/`）

| 檔案 | 職責 |
|------|------|
| `index.ts` | **公開 barrel**（新程式優先從此匯入） |
| `locale.ts` | 偏好／有效 locale、storage、listeners、`document.lang`、Intl 對照 |
| `i18n.ts` | i18next 初始化 + namespaces；訂閱 `onAppLocaleChange` → `changeLanguage` |
| `formatMessage.ts` | `{name}` 模板、`joinList`／`getListSeparator` |
| `messageKeys.ts` | 高頻模板 key 常數（`MSG_*`） |
| `errorCodes.ts` | `messageForErrorCode`（即時查 `common:errors.*`） |
| `locales/{zh-Hant,zh-Hans,en}/*.json` | 翻譯資源（`zh-Hant` 為 source of truth） |

**匯入慣例：** 程式／測試請用 `from ".../i18n"`（barrel）。深路徑 `i18n/i18n` 由 `tests/smoke/architecture-invariants.test.ts` **禁止**（白名單已清零並移除）。

**測試 harness：** `web/src/test/i18nHarness.ts` 提供 `ensureZhHantLocale`／`wrapWithI18n`（`I18nextProvider` + zh-Hant）；新 UI 測試優先用此，勿再複製 Provider／`setAppLocale("zh-Hant")`。

### Preference vs resolved locale

| API | 意義 |
|-----|------|
| `AppLocalePreference` | `auto` \| `zh-Hant` \| `zh-Hans` \| `en` — **存於** `localStorage` `im:ui-locale` |
| `getAppLocalePreference` / `setAppLocalePreference` | 讀寫偏好；`set*` 會解析、通知、同步 server |
| `AppLocale` / `getAppLocale` | **解析後**有效 locale（永不為 `auto`） |
| `setAppLocale(locale)` | 手動鎖定具體語系（≡ `setAppLocalePreference(locale)`，測試／舊呼叫點相容） |
| `resolveAppLocale(pref, navigatorLanguage?)` | `auto` → 依 `navigator.language` 映射 |
| Server `uiLocale` | **僅具體值**；`setAppLocalePreference` best-effort `PUT` 解析結果。背景分析／無瀏覽器請求以此為準 |

`auto` 映射：`zh-TW`／`zh-HK`／`zh-MO`／`zh-Hant*` → `zh-Hant`；`zh-CN`／`zh-SG`／`zh-Hans*` → `zh-Hans`；其餘 `zh*` → `zh-Hant`；非中文 → `en`。偏好為 `auto` 時監聽 `languagechange` 重解析。

## 函式庫與範圍

| 項目 | 說明 |
|------|------|
| 函式庫 | `i18next` + `react-i18next`（`web/src/i18n/i18n.ts`） |
| Locale | `zh-Hant`（預設手動）／`zh-Hans`／`en`；偏好另含 `auto` |
| 切換 UI | **設定 → 一般**（`LanguageSwitcher`：自動／繁中／簡中／English；整站介面跟隨選擇）。主題頁僅主題，不含語言 |
| Namespaces | `common`、`tasks`、`board`、`nav`、`actions`、`intelligence`、`monitor`、`sources`、`timeline`、`settings`、`assistant`、`logs`、`items`、`schedule`、`account`、`workset`、`viewer`、`leaderboard`（SoT：`i18n.ts` 的 `NAMESPACES`；parity 腳本以 `locales/zh-Hant/*.json` 自動發現，新增檔案不需改腳本） |
| Interpolation | `{name}`（非 `{{name}}`）；見 `i18n.ts` `prefix`／`suffix` |
| 列表分隔 | `joinList`／`common:ui.listSep`（中文 `、`、英文 `, `） |
| 產品 chrome | 主路徑 UI（側欄／設定／Actions／Intelligence／Monitor／Sources／Timeline／Items／Logs／Assistant／board／任務表單／本機通知／排行榜等）已三語；UAT 就緒 |
| 明確不做 | 任務／頻道等**用戶內容**；主題專有名詞（Latte／Mocha 等）；切語言不重跑歷史分析；Email auth-error **regex**（非 UI chrome） |
| TTS／STT | `speechLanguage` **仍獨立**，不跟 UI locale／`ui_locale` 自動綁死 |

### 已知剩餘（硬編碼中文／非 chrome）

| 區域 | 代表路徑 | 說明 |
|------|----------|------|
| 故意保留 | `EmailMailboxForm.tsx` auth-error regex；主題專有名詞（Latte／Mocha 等） | 非 chrome／非 UI 標籤 |
| API 範例 | `domain/apiDocs/examples.ts` + `settings:apiDocs.*.example*` | **協議／欄位名英文化**；示範 `content`／`notes`／自然語言 `input` 走 i18n，A2A `locale` 跟當前 UI |
| 天氣城市專名 | `hooks/useMonthWeather.ts` | 時區→城市字串兼 API 查詢鍵（臺北／香港…）；**勿**為 city id 發明翻譯。節日 overlay 用同一字串，伺服器再對到國家碼 |
| 命令面板 keywords | `web/src/domain/commandPalette/commandPaletteCommands.ts` | 搜尋輔助關鍵字（顯示標籤已走 `labelKey`） |
| 後端錯誤原文 | API `message`／`error_summary` passthrough、runtime toast 內嵌後端摘要 | 外層標籤已 i18n |
| 用戶內容 | 任務名／頻道名／訊息正文／AI 產出欄 | 非產品 chrome |

## AI 輸出語言（跟隨介面）

- **規則**：助手回覆與分析 JSON 內用戶可見文字欄（title／summary／description 等）**跟隨介面語言**（`zh-Hant`／`zh-Hans`／`en`）。
- **做法**：不整份翻譯 system prompt；在既有 prompt 末尾追加 output-language directive（`server/prompts/locale.py` → `output_language_directive`）。
- **單一路徑**：`server/prompts/locale.py` ← `agent/runtime.py`／`analyzer/engine.py`／`analyzer/prompt.py`／`api/routes/config.py`；批次經 `scheduler/batch.py` 讀 `ui_locale` 再交給 analyzer 組裝。
- **Prompt 雙層**：`prompts/*` 放字串範本；`analyzer/prompt.py`（與 agent runtime）負責組裝與附加 locale directive——找文案看 `prompts/`，找怎麼拼看 assembly。
- **解析順序**：請求可選 `locale`（助手 chat／task advisor）→ 否則 `get_config(ui_locale)` → `normalize_ui_locale` 未知值（含前端偏好 `auto`）回退 `zh-Hant`；API **不接受** 把 `auto` 寫入 server `uiLocale`。
- **同步**：`setAppLocale`／`setAppLocalePreference` 寫入 `localStorage`（偏好可為 `auto`）並 best-effort `PUT` **解析後** settings（`uiLocale`）；localStorage 負責即時 UI，server 副本服務背景分析批次。

## Channel／ActionType 命名

| 名稱／路徑 | 實際職責 |
|------------|----------|
| `components/channels/SourceChannelPickerContent`（+ `ChannelPickerDialogShell`／`ChannelSelectorDialog`） | **帳號／頻道** picker（選要監聽的來源頻道） |
| `pages/notify/components/ActionTypeSelector.tsx` | **ActionType** 瓦片選擇器（通知外發類型：Telegram Bot／Discord／HTTP／MQTT） |
| `pages/notify/components/ActionTypeFields.tsx` | 依已選 ActionType 渲染對應表單欄位 |

## 翻譯流程

1. 以 **zh-Hant** JSON 為 source of truth（`web/src/i18n/locales/zh-Hant/`）。
2. 手翻 `en`／`zh-Hans`；不用整庫 OpenCC 自動轉。
3. 元件用 `useTranslation()`／`t()`；非 React 用 `i18n.t()` 或 helper（如 `platformScopeLabel`、`formatStatusLabel`、`formatMessage`、`joinList`）。
4. 變更 locale：`setAppLocale(locale)` 或 `setAppLocalePreference(pref)` → 寫入 storage + `applyDocumentLang` + `i18n.changeLanguage` + 同步 server `ui_locale`（具體值）。
5. 測試：需要可見文案時包 `I18nextProvider` + `setAppLocale("zh-Hant")`（或目標 locale）。新測試優先 `import { … } from "../../i18n"`。
6. **對齊檢查**：`npm run i18n:check`（`scripts/check-i18n-parity.mjs`）比對三語 leaf key，並拒絕無 `t()`／字面引用且不在 allowlist 的鍵（動態拼 key、`FORBIDDEN_KEYS` 對照）；納入 `npm run check`。
7. **禁止殘留**：已退役 UI chrome **不得**因補翻譯加回 JSON。機器 SoT 是 `scripts/check-i18n-parity.mjs` 的 `FORBIDDEN_KEYS` — 本 glossary **不**平行列舉鍵名。產品理由（LAN bind 開關、助手頁 per-session LLM 設定檔、物品頁冗餘標題）見 [`KNOWN-SIMPLIFICATIONS.md` Removed / not restored](KNOWN-SIMPLIFICATIONS.md#removed--not-restored)；顯示名替代見下表「標籤單一來源」。
8. **複數鍵（plural family）**：`key`／`key_one`／`key_other`（及其他 CLDR 後綴 `_zero`／`_two`／`_few`／`_many`）視為**同一複數族**，以基鍵歸一比對——中文只有單一複數類別，用裸 `key`；en 可展開 `key_one`／`key_other`（i18next 依 `count` 自動選形）。任一 locale 用了後綴形就**必須含 `_other`**，否則 parity 直接判 fail。範例：`settings:theme.focalRefreshHours`、`common:ui.itemsCount`、`tasks:detail.channelCount`（zh 裸鍵、en `_one`+`_other`）。只在**英文數詞一致性真的會出錯**時展開（`1 items`）；像 `+{count} more`／`Retry {count}` 這種無可數名詞的字串維持單一裸鍵。呼叫端**必須傳數字型 `count`**——傳字串會讓 i18next 跳過複數選形，只查得到裸鍵。

## 標籤單一來源（避免平行翻譯）

| 顯示位置 | 應用 key | 勿再平行維護 |
|----------|----------|--------------|
| 側欄「系統設定」／設定麵包屑根 | `nav:systemSettings` | 勿再平行維護 `settings:shell.*RootLabel`（已刪除） |
| 側欄「AI 設定」／AI 麵包屑根 | `nav:aiSettings` | 同上 |
| 設定分頁（一般／主題／…） | `settings:tabs.*` | command palette 等請引用同一語意，勿另造近似 key |
| 設定分頁「外部接口」 | `settings:tabs.integrations` | en **External interfaces**；zh-Hans／zh-Hant 皆 **外部接口**（顯示名勿寫 API／外部介面）。SoT `/settings/integrations` query `tab=webhook` / `a2a` / `deeplink` / `mcp`（無 `/settings/api`／`/settings/mcp` 轉址） |
| 外部接口 pill「日曆連結」 | `settings:integrations.deeplink`／`settings:apiDocs.deepLink.title`／`common:commandPalette.settingsDeeplink` | zh-Hant **日曆連結**；zh-Hans **日历链接**；en **Calendar link**。pill／面板標題／命令面板顯示名皆此短標；URL `tab=deeplink` 勿改。勿在 pill 寫 Deep link／Desktop。舊稱「Desktop 日曆 deep link」僅命令面板 **alias**。面板內文可保留 Desktop／協定說明。timeline `source.url`「日曆連結」是匯入來源類型，與此 pill 共用短標但不是同一 surface |
| 帳戶存取金鑰 | `account:accessKeys.*` | 只建立／撤銷；新鑰一律 `*`；既有 `read` 僅列表狀態「唯讀」。能力群組在外部接口 → MCP 與 A2A（同一套 `mcp_cap_*`）；工作集「外部接口」在 `/worksets`（`worksets.external_enabled`），不是金鑰 scope。MCP／A2A 各有獨立「啟用」（`mcpDocs.masterSwitch`／`a2aDocs.masterSwitch`） |
| 側欄「日誌」短標 | `nav:logs` | 與 `settings:tabs.logs`（「系統日誌」）刻意不同長度 |

## 日誌正文語言

- UI chrome（篩選、分頁）跟隨當前 locale。
- **新批次失敗日誌**在 `details` 存 `messageKey` + `messageParams`；Logs 列表／詳情／board widget 顯示時以 `domain/logs/resolveLogDisplayMessage` 再 `t()`，切語系可重翻。AI／LLM 失敗另保留 `failureKind`／`httpStatus`／`responseBody`（截斷片段，供 Settings→Logs 除錯）。
- **舊日誌**仍是寫入時已翻成字串的 `message`（fallback）；前端 runtime 多數同時帶 `messageKey` 與 write-time `message`。
- 後端英文 fallback SoT：`server/app_logging.py` `_BATCH_FAILURE_MESSAGE_EN`（落庫 `message` 預覽）與 `logs:templates.*`（顯示重翻）需保持語意對齊。其他高價值伺服器事件（`scheduler.*`／`source.error`／`retention.cleanup`）同樣走 `AppLog.record` + `messageKey`。

## 任務模板 Presets（顯示文案 SoT）

- **顯示文案 SoT**：[`shared/task_presets.json`](../shared/task_presets.json) — 各 preset 的 `i18n.{zh-Hant,en,zh-Hans}.{name,description,promptTemplate}`。UI 經 `localizeTaskPreset()` 查 locale key。
- **API fallback**：[`server/presets/task_presets.py`](../server/presets/task_presets.py) 執行時從 JSON 載入 `BUILTIN_PRESETS`（zh-Hant 切片）。`webSearchQuery` 已從 schema／OpenAPI／FE 移除（Agent 從 prompt 自行選關鍵字；見 [`SCHEMA-BASELINE.md`](./SCHEMA-BASELINE.md)／[`RETIRED-API.md`](./RETIRED-API.md)）。
- **結構欄位** `id` / `analysisMode` / `defaultAnalysisTimeRange` / `badge` 僅在 JSON 來源定義。Agent 模板另有 `agentPreset`（對應編輯器模式卡）與 trigger／output／cap 欄位，供套用時對齊 `AgentTaskSpec`；API `GET /tasks/templates` 仍只回傳顯示欄位，FE 以 `CATALOG_AGENT_PRESET_ID` 對應模式卡。
- **改文案流程**：編輯 `shared/task_presets.json`，再跑 `npm run sync:presets` 寫入三語 `tasks.json` → `presets.*`；`npm run sync:presets:check` 只檢查不覆寫。
- **防漂移**：`server/tests/test_task_preset_i18n_parity.py` 對每個 preset id 断言 zh-Hant JSON 與 `BUILTIN_PRESETS` 三欄文字相等，改一邊忘改另一邊會直接測試失敗。
- **產品目錄（精簡）**：排行榜 `leaderboard` 兩則（`leaderboard-hot-topics` 熱門話題排行、`leaderboard-discussion-heat` 討論熱度）；情報 `intel_event` 八則（`key-insights` 關鍵情報摘要、`schedule-time-inference` 時間行程推理、`iot-device-alerts` IoT 設備告警、`crypto-airdrop-deals` 薅羊毛情報、`schedule-events` 行程事件提取、`security-scam-watch` 資安詐騙警示、`policy-regulation` 政策法規動態、`finance-markets` 金融市場要聞）；專案經理 `agent` 四則（`agent-work-shift` 工作輪更、`agent-project-schedule` 專案日程、`agent-source-verify` 來源核實、`agent-pure-web-search` 純網搜）。編輯器內 Agent 模式卡是 `project_reconcile`／`web_scout`／`pure_web_search`。排行榜任務仍走 `/leaderboard` + 通知，不進情報事件頁。

## 產品用語

| 概念 | 定稿（zh-Hant） | en | zh-Hans |
|------|-----------------|----|---------|
| 分析 mode `intel_event`／任務類型徽章 | **情報任務** | Intel task | 情报任务 |
| 情報頁／側欄／widget／事件結果 | **情報事件** | Intel events | 情报事件 |
| 泛稱資料／地圖無座標等（非產品名） | **情報** | intelligence | 情报 |
| mode `leaderboard` | 排行榜任務 | Leaderboard task | 排行榜任务 |
| mode `agent` | **專案經理任務** | Project Manager task | 项目经理任务 |
| Agent 模式 `project_reconcile` | **對帳日曆**（把已綁來源的班表／會議／截止寫進「我的日程」；不上網；現況來源以 Telegram 為主） | Calendar reconcile | 对账日历 |
| Agent 模式 `web_scout` | **來源 + 網搜** | Sources + web search | 来源 + 网搜 |
| Agent 模式 `pure_web_search` | **純網搜** | Pure web search | 纯网搜 |
| Agent 詳情頁（路由仍可含 `project*` 檔名） | **專案經理詳情**／Agent tick（勿對用戶說「開啟專案」） | Project Manager detail | 项目经理详情 |
| standalone calendar recurring series | 週期序列 | Recurring series | 周期序列 |
| `__general__`（`SYSTEM_WORKSET_ID`）內建工作集 | **一般**（詳見下節） | General | 一般 |
| 工作集頁分段（`/worksets?tab=`） | **目錄**／**流程圖** | Catalog / Graph | 目录／流程图 |
| 流程圖層標題 | **第一層**…**第四層** | Layer 1–4 | 第一层…第四层 | 勿寫輸入／輸出當層名；塊標題（來源／物品／任務／助手／工作集）；L4 為共用輸出圖例（時間規劃／情報頁／通知／外部接口），從工作集**層／區塊**連出而非每張卡片；通知／外部接口閘門仍是卡片 icon；勿加 MCP／A2A 頁節點；**我的日程**不是流程圖塊（日曆疊加全部工作） |
| 虛擬系統卡 `user-or-assistant`（Dashboard 功能卡，非工作集） | 用戶或助手（詳見下節） | User or Assistant | 用户或助手 |
| 助手（含彈窗／完整頁） | **助手** | Assistant | 助手 |
| 「快捷助手」 | 僅命令面板／搜尋 **alias**（非產品顯示名） | search alias only | 仅搜索别名 |
| 收集子系統 | **收集器**（勿用「採集器」） | Collector | 收集器 |
| 物品頁／trackable inventory | **物品**（namespace `items`） | Items | 物品 |
| 我的日程頁（管理區） | **我的日程**（namespace `schedule`；`schedule.json`） | My schedule | 我的日程 | 與任務 `scheduleRrule`／時間規劃 timeline 文案分離；頁面用 `useTranslation("schedule")` |
| 監控模式 `canvas`（自由排版儀表） | **畫布** | Ops Board | 画布 | UI 顯示名**單一**（勿再寫「畫布／Ops Board」）；代碼 mode=`canvas`、prefs=`ops_board_*`、目錄 `board/` **勿改** |
| 實體／工作集「會不會響」開關（語音／畫面／最近一天） | **通知**（勿稱提醒） | Notify / Notification | 通知 |
| 通知通道：朗讀 | **語音** | Voice | 语音 |
| 通知通道：頂欄專用條（非操作 toast） | **畫面** | On-screen | 画面 |
| 畫面呈現：約 10 秒後自動消失 | **閃現** | Flash (timed) | 闪现 |
| 畫面呈現：直至關閉 | **持續** | Persistent | 持续 |
| 日曆相對開始日的前置天數 | **提前天數**（勿稱提醒／提前提醒） | Days ahead | 提前天数 |
| 日期／時間欄旁填入本機此刻 | **現在** | Now | 现在 |
| 情報管線檢查清單（Tasks／Intelligence，非 FirstRun、非時間規劃） | **情報管線** | Intelligence pipeline | 情报管线 |
| 情報卡校正（timeline_dismissals） | **不是情報** | Not intelligence | 不是情报 |
| 時間規劃卡校正 | **從時間軸拿掉** | Take off timeline | 从时间轴拿掉 |
| Agent 任務頁收回最近完成批次寫入 | **收回最近一次調和** | Retract last reconcile | 收回最近一次调和 |

## AI 員工（staff／employees／intro）

產品顯示名統一稱 **AI 員工**（en: **AI Staff**）。下列 id／路徑**刻意雙名**，只改文案對照，**不要**為統一用語而改 wire／API／路由 id。

| 層 | 定稿用語 | 代碼／路徑（勿改） | 說明 |
|----|----------|-------------------|------|
| 花名冊頁 | AI 員工介紹 | 路由 `/ai/staff`；i18n `settings:staff.*`／`nav`·`common` 的 `aiStaff`；`web/src/domain/aiStaff/` | 只讀介紹頁；以 `AI_STAFF_ROSTER` 為準（前線：助手、任務顧問；後勤：排行榜分析員、情報任務分析員、專案經理）+ 頁內「客戶經理」（code id `liaison`，非 `AiStaffId` runtime）。**勿**在產品文案寫死「六位／Six AI」等易過時人數 |
| 任務類型徽章／選擇器 | 員工名（情報任務／排行榜任務／專案經理任務） | FE `TaskEmployeeId` + i18n `common:tasks.employees.*` | 對應 `analysisMode`（`intel_event`／`leaderboard`／`agent`）；員工 id 與 enum token 對齊 |
| AI 頭像／對話列 | AI Staff | `AiStaffId`、`components/aiStaff/*` | 有 AI 的分析任務才顯示頭像；週期序列不是 analysis task |
| 介紹文案 | intro | `settings:staff.intro` 等 | 文案 SoT 在 locale JSON；glossary 只鎖「員工／Staff」產品名 |

**對照規則：** UI 對用戶說「員工／Staff」；任務表單內部類型 id 可叫 employee；後端與 OpenAPI 繼續用 `analysisMode`／`agent` 等既有 id。

### 平台範圍名詞（`common.platformScope.*`）

| key | zh-Hant | en | zh-Hans |
|-----|---------|----|---------|
| source | 來源 | Source | 来源 |
| channel | 頻道 | Channel | 频道 |
| feed | Feed | Feed | Feed |
| url | 網址 | URL | 网址 |
| broker | Broker | Broker | Broker |
| folder | 資料夾 | Folder | 文件夹 |
| endpoint | 端點 | Endpoint | 端点 |

## 系統任務卡標題與工作集顯示名

- **「一般」**（`workset.generalName`）是內建工作集 `SYSTEM_WORKSET_ID`（wire id `__general__`）的 canonical 顯示名。篩選樹、by_workset 分組、語音／助手預設歸屬都用此名；**不要**把工作集顯示成「用戶或助手」。
- **「用戶或助手」**僅指 Dashboard 系統虛擬任務卡（id=`user-or-assistant`，功能層：手寫／助手建日程入口）。它**不是**工作集，也不進來源篩選樹當假 `taskId`。
- 舊表述「unassigned = `__user__`」已廢棄；內建 id 現為 `__general__`：那是 builtin 歸屬工作集，不是「未歸屬任務」哨兵。

| id | zh-Hant | en | zh-Hans |
|----|---------|----|---------|
| `user-or-assistant`（virtual card） | 用戶或助手 | User or Assistant | 用户或助手 |
| `__general__` / `SYSTEM_WORKSET_ID`（workset） | 一般 | General | 一般 |
| `collector` | 收集器 | Collector | 收集器 |
| `analysis-batch` | 分析批次 | Analysis batch | 分析批次 |
| `outbound-notify` | 外發通知 | Outbound notify | 外发通知 |
| `local-notify` | 本機通知 | Local notifications | 本机通知 |
| `retention` | 資料清理 | Data cleanup | 资料清理 |
| `startup-geocode` | 啟動座標回填 | Startup geocode backfill | 启动坐标回填 |
| `holiday` | 節日 | Holiday | 节日 |

## API 錯誤碼約定

- 用戶可見錯誤優先穩定 **`error_code`**（snake_case）。
- 前端 `toErrorMessage` 先查 `common:errors.*`（via `messageForErrorCode`），否則 fallback `message`。
- 新端點請用 `server.errors.http_error(...)` 帶明確 `error_code`，避免只回中文 `detail` 字串。
- 試點碼：`weather_timeout`、`weather_unavailable`、`weather_location_not_found`、`weather_invalid_date_range`、`holiday_invalid_year`、`holiday_invalid_location`、`agent_timeout`。

## Locale

- 預設 UI locale：`zh-Hant`（不因 `navigator.language` 自動覆蓋；須使用者選「自動」才跟隨系統）。
- `Intl`／`localeCompare` 經 `getDateTimeLocale()`（BCP47：`zh-Hant` → `zh-TW`，`zh-Hans` → `zh-CN`，`en` → `en-US`）。
