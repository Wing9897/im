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
| Namespaces | `common`、`nav`、`actions`、`intelligence`、`monitor`、`sources`、`timeline`、`settings`、`assistant`、`logs`、`items` |
| Interpolation | `{name}`（非 `{{name}}`）；見 `i18n.ts` `prefix`／`suffix` |
| 列表分隔 | `joinList`／`common:ui.listSep`（中文 `、`、英文 `, `） |
| 產品 chrome | 主路徑 UI（側欄／設定／Actions／Intelligence／Monitor／Sources／Timeline／Items／Logs／Assistant／board／任務表單／語音提醒／排行榜等）已三語；UAT 就緒 |
| 明確不做 | 任務／頻道等**用戶內容**；主題專有名詞（Latte／Mocha 等）；切語言不重跑歷史分析；Email auth-error **regex**（非 UI chrome） |
| TTS／STT | `speechLanguage` **仍獨立**，不跟 UI locale／`ui_locale` 自動綁死 |

### 已知剩餘（硬編碼中文／非 chrome）

| 區域 | 代表路徑 | 說明 |
|------|----------|------|
| 故意保留 | `EmailMailboxForm.tsx` auth-error regex；主題專有名詞（Latte／Mocha 等） | 非 chrome／非 UI 標籤 |
| API 範例 | `domain/apiDocs/examples.ts` + `settings:apiDocs.*.example*` | **協議／欄位名英文化**；示範 `content`／`notes`／自然語言 `input` 走 i18n，A2A `locale` 跟當前 UI |
| 天氣城市專名 | `hooks/useMonthWeather.ts` | 時區→城市字串兼 API 查詢鍵（臺北／香港…）；**勿**為 city id 發明翻譯 |
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
| `components/channels/AccountChannelPickerContent`（+ `ChannelPickerDialogShell`／`ChannelSelectorDialog`） | **帳號／頻道** picker（選要監聽的來源頻道） |
| `pages/actions/ActionTypeSelector.tsx` | **ActionType** 瓦片選擇器（通知外發類型：Telegram Bot／Discord／HTTP／MQTT） |
| `pages/actions/ActionTypeFields.tsx` | 依已選 ActionType 渲染對應表單欄位 |

## 翻譯流程

1. 以 **zh-Hant** JSON 為 source of truth（`web/src/i18n/locales/zh-Hant/`）。
2. 手翻 `en`／`zh-Hans`；不用整庫 OpenCC 自動轉。
3. 元件用 `useTranslation()`／`t()`；非 React 用 `i18n.t()` 或 helper（如 `platformScopeLabel`、`formatStatusLabel`、`formatMessage`、`joinList`）。
4. 變更 locale：`setAppLocale(locale)` 或 `setAppLocalePreference(pref)` → 寫入 storage + `applyDocumentLang` + `i18n.changeLanguage` + 同步 server `ui_locale`（具體值）。
5. 測試：需要可見文案時包 `I18nextProvider` + `setAppLocale("zh-Hant")`（或目標 locale）。新測試優先 `import { … } from "../../i18n"`。
6. **對齊檢查**：`npm run i18n:check`（`scripts/check-i18n-parity.mjs`）比對三語 leaf key；納入 `npm run check`。

## 標籤單一來源（避免平行翻譯）

| 顯示位置 | 應用 key | 勿再平行維護 |
|----------|----------|--------------|
| 側欄「系統設定」／設定麵包屑根 | `nav:systemSettings` | 勿再平行維護 `settings:shell.*RootLabel`（已刪除） |
| 側欄「AI 設定」／AI 麵包屑根 | `nav:aiSettings` | 同上 |
| 設定分頁（一般／主題／…） | `settings:tabs.*` | command palette 等請引用同一語意，勿另造近似 key |
| 側欄「日誌」短標 | `nav:logs` | 與 `settings:tabs.logs`（「系統日誌」）刻意不同長度 |

## 日誌正文語言

- UI chrome（篩選、分頁）跟隨當前 locale。
- **新批次失敗日誌**在 `details` 存 `messageKey` + `messageParams`；Logs 列表／詳情／board widget 顯示時以 `domain/logs/resolveLogDisplayMessage` 再 `t()`，切語系可重翻。AI／LLM 失敗另保留 `failureKind`／`httpStatus`／`responseBody`（截斷片段，供 Settings→Logs 除錯）。
- **舊日誌**仍是寫入時已翻成字串的 `message`（fallback）；前端 runtime 多數同時帶 `messageKey` 與 write-time `message`。
- 後端英文 fallback SoT：`server/app_logging.py` `_BATCH_FAILURE_MESSAGE_EN`（落庫 `message` 預覽）與 `logs:templates.*`（顯示重翻）需保持語意對齊。其他高價值伺服器事件（`scheduler.*`／`account.error`／`retention.cleanup`）同樣走 `AppLog.record` + `messageKey`。

## 任務模板 Presets（顯示文案 SoT）

- **顯示文案 SoT**：[`shared/task_presets.json`](../shared/task_presets.json) — 各 preset 的 `i18n.{zh-Hant,en,zh-Hans}.{name,description,promptTemplate}`。UI 經 `localizeTaskPreset()` 查 locale key。
- **API fallback**：[`server/presets/task_presets.py`](../server/presets/task_presets.py) 執行時從 JSON 載入 `BUILTIN_PRESETS`（zh-Hant 切片）；`web_intel` 可選頂層 `webSearchQuery`（語系無關關鍵詞）。
- **結構欄位** `id` / `analysisMode` / `defaultAnalysisTimeRange` / `badge`（及可選 `webSearchQuery`）僅在 JSON 來源定義。
- **改文案流程**：編輯 `shared/task_presets.json`，再跑 `npm run sync:presets` 寫入三語 `common.json` → `tasks.presets.*`；`npm run sync:presets:check` 只檢查不覆寫。
- **防漂移**：`server/tests/test_task_preset_i18n_parity.py` 對每個 preset id 断言 zh-Hant JSON 與 `BUILTIN_PRESETS` 三欄文字相等，改一邊忘改另一邊會直接測試失敗。

## 產品用語

| 概念 | 定稿（zh-Hant） | en | zh-Hans |
|------|-----------------|----|---------|
| 分析 mode `event`／情報頁／側欄／widget | **關鍵事件** | Key Events | 关键事件 |
| 泛稱資料／地圖無座標等（非產品名） | **情報** | intelligence | 情报 |
| mode `leaderboard` | 排行榜 | Leaderboard | 排行榜 |
| mode `web_intel` | **網路情報** | Web intel | 网络情报 |
| mode `project` | 專案（閉環） | Project | 项目（闭环） |
| mode `recurring` | 循環任務 | Recurring task | 循环任务 |
| `__user__`（`SYSTEM_WORKSET_ID`）內建工作集 | **一般**（詳見下節） | General | 一般 |
| 虛擬系統卡 `user-or-assistant`（Dashboard 功能卡，非工作集） | 用戶或助手（詳見下節） | User or Assistant | 用户或助手 |
| 助手（含彈窗／完整頁） | **助手** | Assistant | 助手 |
| 「快捷助手」 | 僅命令面板／搜尋 **alias**（非產品顯示名） | search alias only | 仅搜索别名 |
| 收集子系統 | **收集器**（勿用「採集器」） | Collector | 收集器 |
| 物品頁／trackable inventory | **物品**（namespace `items`） | Items | 物品 |

## AI 員工（staff／employees／intro）

產品顯示名統一稱 **AI 員工**（en: **AI Staff**）。下列 id／路徑**刻意雙名**，只改文案對照，**不要**為統一用語而改 wire／API／路由 id。

| 層 | 定稿用語 | 代碼／路徑（勿改） | 說明 |
|----|----------|-------------------|------|
| 花名冊頁 | AI 員工介紹 | 路由 `/ai/staff`；i18n `settings:staff.*`／`nav`·`common` 的 `aiStaff`；`web/src/domain/aiStaff/` | 只讀介紹頁；含助手、任務編輯、排行榜、關鍵事件、**網路情報**、專案管理員 + 頁內「客戶經理」（code id `liaison`，非 `AiStaffId` runtime） |
| 任務類型徽章／選擇器 | 員工名（循環日程／關鍵事件／網路情報…） | FE `TaskEmployeeId` + i18n `common:tasks.employees.*` | 對應 `analysisMode`（`recurring`／`event`／`web_intel`／`leaderboard`／`project`）；**DB／API enum 仍是 analysisMode** |
| AI 頭像／對話列 | AI Staff | `AiStaffId`、`components/aiStaff/*` | 有 AI 的任務類型才顯示頭像；`scheduleClerk`（recurring）無 AI avatar |
| 介紹文案 | intro | `settings:staff.intro` 等 | 文案 SoT 在 locale JSON；glossary 只鎖「員工／Staff」產品名 |

**對照規則：** UI 對用戶說「員工／Staff」；任務表單內部類型 id 可叫 employee；後端與 OpenAPI 繼續用 `analysisMode`／`web_intel` 等既有 id。

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

- **「一般」**（`workset.generalName`）是內建工作集 `SYSTEM_WORKSET_ID`（wire id `__user__`）的 canonical 顯示名。篩選樹、by_workset 分組、語音／助手預設歸屬都用此名；**不要**把工作集顯示成「用戶或助手」。
- **「用戶或助手」**僅指 Dashboard 系統虛擬任務卡（id=`user-or-assistant`，功能層：手寫／助手建日程入口）。它**不是**工作集，也不進來源篩選樹當假 `taskId`。
- 舊表述「unassigned = `__user__`」已廢棄：`__user__` 是 builtin 歸屬工作集，不是「未歸屬任務」哨兵。

| id | zh-Hant | en | zh-Hans |
|----|---------|----|---------|
| `user-or-assistant`（virtual card） | 用戶或助手 | User or Assistant | 用户或助手 |
| `__user__` / `SYSTEM_WORKSET_ID`（workset） | 一般 | General | 一般 |
| `collector` | 收集器 | Collector | 收集器 |
| `analysis-batch` | 分析批次 | Analysis batch | 分析批次 |
| `outbound-notify` | 外發通知 | Outbound notify | 外发通知 |
| `voice-reminder` | 語音提醒 | Voice reminder | 语音提醒 |
| `retention` | 資料清理 | Data cleanup | 资料清理 |
| `startup-geocode` | 啟動座標回填 | Startup geocode backfill | 启动坐标回填 |

## API 錯誤碼約定

- 用戶可見錯誤優先穩定 **`error_code`**（snake_case）。
- 前端 `toErrorMessage` 先查 `common:errors.*`（via `messageForErrorCode`），否則 fallback `message`。
- 新端點請用 `server.errors.http_error(...)` 帶明確 `error_code`，避免只回中文 `detail` 字串。
- 試點碼：`weather_timeout`、`weather_unavailable`、`weather_location_not_found`、`weather_invalid_date_range`、`agent_timeout`。

## Locale

- 預設 UI locale：`zh-Hant`（不因 `navigator.language` 自動覆蓋；須使用者選「自動」才跟隨系統）。
- `Intl`／`localeCompare` 經 `getDateTimeLocale()`（BCP47：`zh-Hant` → `zh-TW`，`zh-Hans` → `zh-CN`，`en` → `en-US`）。
