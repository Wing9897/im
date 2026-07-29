"""Built-in **task template catalog** (user-selectable analysis intents).

``BUILTIN_PRESETS`` is a curated list of ready-to-use analysis task presets
(e.g. "trending topics", "schedule events") that a user can apply when
creating a task. Each preset carries both display text (``name`` /
``description`` / ``promptTemplate``) and structural fields (``id`` /
``analysisMode`` / ``defaultAnalysisTimeRange`` / ``badge``).

This is **not** :mod:`server.prompts` — that package holds the versioned
system/schema prompt strings assembled at analysis/agent runtime
(``analyzer/prompt.py`` / ``agent/runtime.py``). This module is a static,
user-facing catalog served over the API instead.

**Display-text source of truth**: the zh-Hant UI locale —
``web/src/i18n/locales/zh-Hant/common.json`` → ``tasks.presets.<id>``. The
Chinese ``name`` / ``description`` / ``promptTemplate`` strings below are the
API **fallback** (served to non-localized clients and used as the i18next
``defaultValue`` in ``localizeTaskPreset``) — they must stay byte-for-byte in
sync with that locale, not edited independently. Sync with
``uv run python scripts/sync_task_presets.py`` after changing the locale;
``server/tests/test_task_preset_i18n_parity.py`` guards against drift. See
``docs/I18N-GLOSSARY.md`` (「任務模板 Presets」) for the full convention.

``id`` / ``analysisMode`` / ``defaultAnalysisTimeRange`` / ``badge`` are
structural and only defined here (not mirrored into locale JSON).

Route logic remains in :mod:`server.api.routes.tasks`.
"""

# ruff: noqa: E501 — preset prompt strings are intentionally long single-line copy

from __future__ import annotations

from typing import Any

BUILTIN_PRESETS: list[dict[str, Any]] = [
    {
        "id": "trending-topics",
        "name": "趨勢主題分析",
        "description": "從訊息中提取熱門討論話題和趨勢，按相關度排名",
        "analysisMode": "leaderboard",
        "promptTemplate": "分析以下訊息，提取最熱門的討論主題。為每個主題提供：標題、摘要、相關度評分(0-1)。按相關度降序排列。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "🔥",
    },
    {
        "id": "key-insights",
        "name": "關鍵情報摘要",
        "description": "提取具有情報價值的關鍵事件與機會",
        "analysisMode": "event",
        "promptTemplate": "從訊息中提取具有情報價值的關鍵事件與線索。優先關注：重要事件、商業機會、風險預警、趨勢變化。有明確時間或地點時一併填入；無法確定則只保留標題與內容。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "💡",
    },
    {
        "id": "schedule-events",
        "name": "行程事件提取",
        "description": "保守提取：只在內容有明確日期／時間（或寫死的時段）時填入排程時間；相對說法（如下星期三）不推理、不換算。適合只要「命中即錄、不猜時間」的場合。",
        "analysisMode": "event",
        "promptTemplate": "從訊息中提取會議、活動、截止日期、發布會等可排程事件。時間規則要保守：只有訊息已寫明可直接落地的日期／時鐘時間（例如 3 月 5 日 14:00、2026-07-20）才填 start_time／end_time；「明天／下星期三／本週五」等相對說法一律不要換算、不要猜測時間（事件本身仍可輸出，時間欄位省略）。優先填寫明確地點與參與者。忽略驗證流程、加群提醒與系統通知。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "📅",
    },
    {
        "id": "schedule-time-inference",
        "name": "時間行程推理",
        "description": "積極推理：即使未寫死年月日，也可從相對說法（如下星期三 6 點、本週五截止、專案／活動節點）換算可排程時間。適合要補齊行程時間線的場合。",
        "analysisMode": "event",
        "promptTemplate": "從訊息中推理可排程的行程、會議、活動、專案節點與截止日期。與「只錄明確時間」不同：本模板鼓勵把相對說法換算成具體時間，例如：下星期三六點開會、本週五截止、下個月交付、活動倒數、專案里程碑。相對時間優先以該則訊息行首 [time=...] 為錨點；缺省時再用系統注入的當前時間。能合理換算則填 start_time／end_time；僅有弱線索時在 body 說明依據，勿無依據硬填。忽略驗證流程、加群提醒與系統通知。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "🗓️",
    },
    {
        "id": "sentiment-monitor",
        "name": "輿情監控",
        "description": "分析群組討論的情緒走向和輿論態勢",
        "analysisMode": "leaderboard",
        "promptTemplate": "分析以下訊息的整體輿情。識別：正面/負面話題、情緒激烈的討論、潛在爭議點。為每個話題評估情緒強度。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "📊",
    },
    {
        "id": "action-items",
        "name": "待辦事項追蹤",
        "description": "提取需要跟進的行動項目和待辦事項",
        "analysisMode": "event",
        "promptTemplate": "提取待辦事項、行動項目、承諾與需要跟進的事項。在 body 寫清要做什麼；相關人員放入 participants；若有明確截止時間再填 start_time。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "✅",
    },
    {
        "id": "crypto-major-intel",
        "name": "Crypto 重大情報",
        "description": "提取加密貨幣重大事件、關鍵情報與時間節點規劃",
        "analysisMode": "event",
        "promptTemplate": "提取 Crypto/Web3 重大情報。在 body 中寫明：情報類型（監管/協議/行情/安全/上線/解鎖/空投/宏觀等）、緊急程度（高/中/低）、建議關注或執行動作。專注於：重大公告、TGE/解鎖/快照/Claim 截止、主網上線、監管判決、大額資金異動、安全漏洞、宏觀政策轉折。有明確時間節點再填 start_time/end_time；忽略閒聊、重複轉貼與無來源謠言。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "₿",
    },
    {
        "id": "crypto-airdrop-deals",
        "name": "薅羊毛情報",
        "description": "提取空投、積分任務、測試網、優惠碼等可獲利機會",
        "analysisMode": "event",
        "promptTemplate": "提取 Crypto/Web3 可獲利機會（空投、積分、測試網、早鳥、返佣、白名單、免費 Mint、任務獎勵等）。在 body 中寫明：項目或平台、機會類型、參與條件與操作步驟摘要、收益預估（如可判斷）、風險提示（詐騙/高 Gas/規則不明）。有明確截止或快照時間再填 start_time；優先列出即將截止或可立即操作的機會。忽略純喊單與無具體操作指引的閒聊；時間無法確定時省略時間欄位。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "🎁",
    },
    {
        "id": "iot-device-alerts",
        "name": "IoT 設備告警",
        "description": "從 MQTT／感測器／裝置日誌擷取故障、離線、門檻越界與安防告警",
        "analysisMode": "event",
        "promptTemplate": "從 IoT／MQTT／感測器／裝置訊息中提取「需要關注或處置」的告警事件。優先：離線／斷線、故障碼、感測值越界（溫濕度／電量／壓力等）、安防觸發、通訊失敗、電池低電、緊急停機。在 body 寫明：裝置或 topic／位置識別、告警類型、嚴重度（高／中／低）、關鍵數值或錯誤碼、建議處置。有明確事件時間再填 start_time；地點可填場站／樓層／區域。忽略：純心跳／keepalive、週期正常讀數、重複且無新資訊的狀態廣播、除錯雜訊。無告警時回傳空 items。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "📡",
    },
    {
        "id": "iot-ops-events",
        "name": "IoT 維運事件",
        "description": "擷取韌體更新、維護視窗、設定變更與裝置上線／佈署節點",
        "analysisMode": "event",
        "promptTemplate": "從 IoT／MQTT／裝置維運訊息中提取可排程或需追蹤的維運事件。優先：韌體／OTA 更新、維護視窗、設定／規則變更、裝置首次上線或汰換、批次佈署、校準、保養到期。在 body 寫明：裝置或系統範圍、事件類型、影響摘要、操作人或來源（如可判斷）、風險或回滾提示。有明確開始／結束再填 start_time／end_time；相對時間可依訊息 [time=...] 或系統時鐘合理換算。忽略：心跳、正常週期遙測、與維運無關的告警雜訊（告警請用其他任務）。無相關事件時回傳空 items。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "🔧",
    },
    {
        "id": "risk-crisis-alerts",
        "name": "風險危機預警",
        "description": "擷取事故、中斷、違規、公關危機與需立即處置的風險",
        "analysisMode": "event",
        "promptTemplate": "從訊息中提取需關注的風險／危機事件。優先：服務中斷、資料外洩、安全事故、合規違規、重大客訴／公關危機、供應中斷、財務或法律風險。在 body 寫明：風險類型、嚴重度（高／中／低）、影響範圍、已知狀態與建議下一步。有明確時間再填 start_time；地點可填。忽略日常抱怨與無行動價值的情緒發洩；無風險時回傳空 items。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "⚠️",
    },
    {
        "id": "people-org-watch",
        "name": "人物組織動態",
        "description": "追蹤人事異動、任命、離職、合作與組織重組",
        "analysisMode": "event",
        "promptTemplate": "提取人物／組織動態事件。優先：任命、離職、升遷、董事會變動、併購／重組、戰略合作、公開發言中的立場轉折。在 body 寫明：人物或組織、事件類型、背景摘要、影響判斷。相關人名放入 participants；有明確時間再填 start_time。忽略純八卦與無核實來源的傳言。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "👤",
    },
    {
        "id": "competitive-intel",
        "name": "競品對手情報",
        "description": "擷取競品定價、功能、行銷活動與策略動向",
        "analysisMode": "event",
        "promptTemplate": "提取競品／對手情報。優先：產品發布、功能對比、定價／促銷、通路變動、行銷戰役、市占或策略轉向。在 body 寫明：對手或產品、情報類型、具體內容、對己方的含義或建議關注點。有明確時間再填 start_time。忽略無依據的抹黑與純情緒比較。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "🏁",
    },
    {
        "id": "security-scam-watch",
        "name": "資安詐騙警示",
        "description": "識別釣魚、盜帳、惡意連結、漏洞與社交工程手法",
        "analysisMode": "event",
        "promptTemplate": "提取資安／詐騙相關警示。優先：釣魚連結、假冒客服、盜帳手法、惡意檔案、已知 CVE／漏洞利用、社工話術。在 body 寫明：威脅類型、手法摘要、辨識特徵、建議防護動作；嚴重度（高／中／低）。有明確時間再填 start_time。忽略玩笑與無操作細節的恐慌轉發；無警示時回傳空 items。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "🛡️",
    },
    {
        "id": "geo-field-events",
        "name": "地理現場事件",
        "description": "提取有地點的活動、事故、集會與現場動態（利於地圖）",
        "analysisMode": "event",
        "promptTemplate": "提取具地理意義的現場事件。優先：集會、事故、災害、店點／據點異動、外勤行程、地方新聞中的明確地點。務必盡量填 location（可解析的地名／地址／場館）；有時間再填 start_time／end_time。在 body 寫明事件摘要與來源語氣。無法定位地點時仍可輸出但 location 留空；忽略無空間資訊的純線上討論。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "📍",
    },
    {
        "id": "policy-regulation",
        "name": "政策法規動態",
        "description": "追蹤立法、監管公告、執法行動與合規期限",
        "analysisMode": "event",
        "promptTemplate": "提取政策／法規／監管動態。優先：法案進度、監管公告、執法裁罰、牌照／許可變更、合規截止日期。在 body 寫明：管轄區或機關、政策主題、狀態（草案／通過／生效／執法）、對相關產業的影響。有明確生效或截止時間再填 start_time／end_time。忽略純政治情緒與無規範含義的評論。",
        "defaultAnalysisTimeRange": "30d",
        "badge": "📜",
    },
    {
        "id": "product-release",
        "name": "產品發布里程碑",
        "description": "擷取上線、版本發布、公開測試與倒數節點",
        "analysisMode": "event",
        "promptTemplate": "提取產品／專案發布與里程碑。優先：正式上線、版本號發布、beta／公開測試、功能開關、倒數／發布會。在 body 寫明：產品名稱、里程碑類型、版本或範圍、重要變更摘要。有明確時間再填 start_time／end_time。忽略無版本資訊的路線圖空談。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "🚀",
    },
    {
        "id": "news-digest-board",
        "name": "要聞摘要排行",
        "description": "把訊息整理成當日最值得關注的要聞榜",
        "analysisMode": "leaderboard",
        "promptTemplate": "將訊息整理為要聞排行榜主題。每個主題提供：標題、一句摘要、相關度評分(0-1)。優先具新聞價值、影響面大、可核實的內容；合併重複轉載。按相關度降序。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "📰",
    },
    {
        "id": "faq-knowledge",
        "name": "問答知識整理",
        "description": "歸納常見問題、解答要點與知識條目",
        "analysisMode": "leaderboard",
        "promptTemplate": "從訊息中歸納 FAQ／知識主題。每個主題提供：問題或條目標題、精煉答案／要點摘要、相關度(0-1)。合併同義反覆提問；標出仍未解答的缺口。按相關度或出現頻率綜合排序。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "❓",
    },
    {
        "id": "rumor-verify",
        "name": "謠言待核實線索",
        "description": "標出傳聞、未證實說法與需要查證的資訊缺口",
        "analysisMode": "event",
        "promptTemplate": "提取「待核實」線索而非當成事實。優先：傳聞、匿名爆料、互相矛盾的說法、缺少來源的斷言。在 body 寫明：主張摘要、為何存疑、已知來源／缺口、建議查證方向。勿把謠言寫成已證實事件；時間不明則省略 start_time。無此類內容時回傳空 items。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "🔍",
    },
    {
        "id": "finance-markets",
        "name": "金融市場要聞",
        "description": "擷取利率、財報、大宗商品與宏觀市場轉折（非僅加密）",
        "analysisMode": "event",
        "promptTemplate": "提取金融／宏觀市場要聞事件。優先：利率／央行、財報與指引、併購、商品／外匯重大波動、監管對市場的影響。在 body 寫明：市場或標的、事件類型、關鍵數據或結論、可能影響。有明確時間再填 start_time。忽略無依據喊單與純情緒預測；加密專題可另用 Crypto 模板。",
        "defaultAnalysisTimeRange": "1d",
        "badge": "📈",
    },
    {
        "id": "meeting-decisions",
        "name": "會議決議結論",
        "description": "從討論中提取決議、共識、反對意見與後續責任人",
        "analysisMode": "event",
        "promptTemplate": "提取會議／討論中的決議與結論。優先：已拍板事項、共識、明確反對、指派負責人、後續檢查點。在 body 寫明：決議內容、狀態（通過／暫緩／反對）、負責人；participants 放相關人。有截止或會議時間再填 start_time。忽略無結論的閒聊。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "🗒️",
    },
    {
        "id": "project-date-crud",
        "name": "通用專案日期管理",
        "description": "依來源訊息為專案新增、修改、刪除單次日期與期限，並在無新訊時對帳既有日程",
        "analysisMode": "project",
        "promptTemplate": "你是通用專案日期管理員。目標：從綁定來源訊息中找出與本專案有關的日期／期限／會議／截止日期，並用工具完成增、改、刪。規則：1) 有明確日期或可合理換算的相對日期才寫入；2) 先查現有日程，能對上就更新，對不上才新建；3) 來源說取消／作廢就刪除或停用；4) 忽略無關閒聊；5) 即使沒有新訊息也要對帳並修正明顯錯誤。完成後用簡短 JSON message 總結本回合改動。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "📅",
    },
    {
        "id": "project-work-shift",
        "name": "工作輪更表",
        "description": "依來源訊息建立與維護工作輪更／更份表，含更份變更、對調與取消",
        "analysisMode": "project",
        "promptTemplate": "你是工作輪更表管理員。目標：從來源訊息建立並持續維護工作輪更／更份表。優先：各人更份（早更／中更／夜更等）、更份對調、加班、休假、取消更份。規則：1) 能對上現有子循環或單次事件就更新，對不上才新建；2) 固定輪更用 recurring 子任務，臨時更動用單次事件；3) 來源說取消／休假就停用或刪除對應項；4) 寫清人名、更份、日期／星期與時間；5) 無新訊息時也要對帳並修正衝突。完成後用簡短 JSON message 總結。",
        "defaultAnalysisTimeRange": "7d",
        "badge": "🕒",
    },
]
