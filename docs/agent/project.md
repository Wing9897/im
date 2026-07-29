# 專案管理 tick（closed-loop）

`analysis_mode=project` 任務由排程驅動多輪 `AgentRuntime`（**不是** `execute_batch` 的一次性 JSON 分析）。

## 行為

1. Scheduler 與 `leaderboard`／`event` 一樣註冊 timer（預設 `hourly`；也允許 `daily`／`custom_seconds`）。
2. 到點呼叫 [`server/scheduler/project_tick.py`](../../server/scheduler/project_tick.py)：
   - 讀取自 `project_message_cursors.last_message_at` 起、綁定來源的增量訊息（每波最多 40 條）。游標為複合值 `timestamp` + 可選 `message_id`（同秒訊息以 id 排序推進；API `cursorAt` 只回傳時間戳）
   - **若 0 條新訊息：不喚醒 LLM**，只寫入 `analysis_batches`（`skipped: no new messages`）後結束——省 token
   - **若有新訊息：抽乾積壓**——每波跑一次 `AgentRuntime`（每波最多 40 條），成功後推進游標再拉下一批，**預設波數無上限**直到沒有新訊息；可選 `agent_project_max_drain_waves`（`0`=無限，正整數=安全上限）
   - **波間冷卻**：任務欄位 `project_wave_interval_seconds`（NULL → 20；`0`=不等待；不再跟隨全域）。任務編輯「排程類型」下方可調，並隨任務一併儲存
   - **同一排程觸發內的多波共用一個連續對話**（同一 `sessionId` + 累積 user/assistant 摘要；每波仍重建置頂 system，並走上下文壓縮）。**跨排程觸發不沿用 session**（下次有新訊息再開新對話）。
   - **System 置頂**：`PROJECT_AGENT_SYSTEM_PROMPT` + 任務 `prompt_template`（專案目標）永遠在 leading system；壓縮時保留。
   - **每一波開始前**重讀：任務仍啟用、仍是 `project` 模式、且全局 `analysis_paused` 未開（含緊急停止）。任一不滿足 → **本輪結束**，已處理波次的游標保留，剩餘積壓留給**下次排程**再抽
   - **每波硬超時**：`llm_generation_timeout * 2`；逾時結束本輪抽乾並保留已推進游標
   - **任務更新與游標**：version bump **不會**一律清游標。僅在進入／離開 project、變更 `prompt_template`（目標）、或變更綁定來源時重置；改名稱／排程／描述會保留進度
   - **進程重啟**：未完成的 project `processing` 批次會標為 `interrupted: process restart` 並完成（不走 marker orphan retry／自動暫停）
   - 每波 user seed：日程摘要 + 本波增量訊息（目標不在 seed 重複，以免脫離置頂）
   - `AgentRuntime(channel=project, max_tool_rounds≈28, project_scope_task_id=本任務)`
3. 「處理中」表示本輪排程觸發（含多波抽乾）進行中；伺服器硬性保證：**沒有新訊息就不叫 AI**，**有積壓就連續抽乾（或被暫停／停用／可選上限打斷）**。日曆增刪改仍由 agent 依目標判斷。注意：暫停／緊急停止**不會取消當前正在跑的那一波 LLM**，只阻止開啟下一波。
4. Marker 型 `/results/stats`（analyzed／unanalyzed）對 project **固定回 0**；進度請看 `project-ticks`（cursor／pending／inFlight）。
## 工具範圍

`project_scope_task_id` 由 runtime 注入；政策在 [`server/agent/project_scope.py`](../../server/agent/project_scope.py)，由 `tools_registry` 呼叫：

| 工具 | 行為 |
|------|------|
| `calendar.*` 讀 | 預設本專案（含 `parent_task_id` 子 recurring 展開） |
| `create/update/delete_event` | 強制 `task_id=本專案` |
| `create_recurring_task` | `analysisMode=recurring` 且 `parent_task_id=本專案` |
| `update/delete_recurring_task` | 僅允許本專案子列（否則 error） |
| `messages.search` | 限制在 `task_channels` |

**Origin：** 專案 tick 透過 `PROJECT_CHANNEL.user_event_origin="project"` 寫入 `user_events.origin=project`（DDL CHECK：`manual`／`assistant`／`a2a`／`project`）。聊天助手仍寫 `assistant`；A2A 寫 `a2a`。

助手／A2A **不會**自動帶上專案 scope；子循環語意僅專案 tick 強制。

## 相關

- Prompt：[`server/prompts/project.py`](../../server/prompts/project.py)（`build_project_base_prompt`）
- Channel：`server/agent/channels.py` → `project`（`stateless=False`，tick 內連續；不持久化跨次排程 UI session）
- AI 員工：`projectManager`（`/ai/staff`）
- Schema：stamp v1／`schemaSemver` 0.1.0-beta.1（空 registry；舊 stamp 須 reset；`user_events.origin` 含 `project`）— 見 [`ARCHITECTURE.md`](../ARCHITECTURE.md)
- UI：任務底下的專案詳情 `/tasks/:taskId/project`（概覽、來源、子循環、所屬事件、最近 tick 訊息與工具步驟）；**不是**與 Sources／Assistant 同層的頂層導航。
