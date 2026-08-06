# 專案調和（Agent closed-loop）

`analysis_mode=agent` 且 `output_calendar`（UI 預設「專案調和」／`project_reconcile`）由排程驅動多輪 `AgentRuntime`（**不是** `execute_batch` 的一次性 JSON 分析）。

舊的獨立 `analysis_mode=project` / `project_tick.py` / `prompts/project.py` 已併入統一 Agent 路徑。

## 行為

1. Scheduler 依 `AnalysisModeSpec.pipeline=agent_tick` 註冊 timer（預設 `hourly`；也允許 `daily`／`custom_seconds`）。
2. 到點呼叫 [`server/scheduler/agent_tick.py`](../../server/scheduler/agent_tick.py)：
   - **`trigger_mode=message_cursor`（專案調和預設）：** 讀取自 `project_message_cursors`（`last_message_at` ISO + 可選 `last_message_id`）起、綁定來源的增量訊息（每波最多 40 條）。同秒訊息以 id 排序推進；API `cursorAt` 只回傳時間戳
   - **若 0 條新訊息：不喚醒 LLM**，只寫入 `analysis_batches`（`skipped: no new messages`）後結束——省 token
   - **若有新訊息：抽乾積壓**——每波跑一次 `AgentRuntime`（每波最多 40 條），成功後推進游標再拉下一批，**預設波數無上限**直到沒有新訊息；可選 `agent_project_max_drain_waves`（`0`=無限，正整數=安全上限）
   - **波間冷卻**：任務欄位 `project_wave_interval_seconds`（NULL → 20；`0`=不等待）。任務編輯「排程類型」下方可調，並隨任務一併儲存
   - **同一排程觸發內的多波共用一個連續對話**（同一 `sessionId` + 累積 user/assistant 摘要；每波仍重建置頂 system，並走上下文壓縮）。**跨排程觸發不沿用 session**
   - **System 置頂**：`AGENT_TASK_SYSTEM_PROMPT_BASE` + 政策條款 + 任務 `prompt_template`（專案目標）永遠在 leading system；壓縮時保留
   - **每一波開始前**重讀：任務仍啟用、仍是 `agent` 模式、且全局 `analysis_paused` 未開。任一不滿足 → **本輪結束**，已處理波次的游標保留
   - **每波硬超時**：`llm_generation_timeout * 2`；逾時結束本輪抽乾並保留已推進游標
   - **任務更新與游標**：version bump **不會**一律清游標。僅在進入／離開 agent、變更 `prompt_template`（目標）、或變更綁定來源時重置；改名稱／排程／描述會保留進度
   - **進程重啟**：未完成的 agent `processing` 批次會標為 `interrupted: process restart` 並完成（不走 marker orphan retry／自動暫停）
   - 每波 user seed：日程摘要 + 本波增量訊息（目標不在 seed 重複，以免脫離置頂）
   - `AgentRuntime(channel=agent via channel_from_agent_spec, max_tool_rounds≈28, project_scope_task_id=本任務)`
3. 「處理中」表示本輪排程觸發（含多波抽乾）進行中；伺服器硬性保證：**沒有新訊息就不叫 AI**，**有積壓就連續抽乾（或被暫停／停用／可選上限打斷）**。暫停／緊急停止**不會取消當前正在跑的那一波 LLM**，只阻止開啟下一波。
4. Marker 型 `/results/stats`（analyzed／unanalyzed）對 agent cursor 任務 **固定回 0**；進度請看 `project-ticks`（cursor／pending／inFlight）。

## 工具範圍

`project_scope_task_id` 由 runtime 注入；政策在 [`server/agent/project_scope.py`](../../server/agent/project_scope.py)，由 `tools_registry` 呼叫：

| 工具 | 行為 |
|------|------|
| `calendar.*` 讀 | 預設本專案（含 `parent_task_id` 子 recurring 展開） |
| `create/update/delete_event` | 強制 `task_id=本專案` |
| `create_recurring_task` | `analysisMode=recurring` 且 `parent_task_id=本專案` |
| `update/delete_recurring_task` | 僅允許本專案子列（否則 error） |
| `messages.search` | 限制在 `task_channels` |

**Origin：** Agent 日曆寫入透過 `channel_from_agent_spec(...).user_event_origin="project"` 寫入 `user_events.origin=project`（DDL CHECK：`manual`／`assistant`／`a2a`／`project`／`ics`）。聊天助手仍寫 `assistant`；A2A 寫 `a2a`。情報輸出走 `analysis_events`，不是 `user_events.origin`。

助手／A2A **不會**自動帶上專案 scope；子週期語意僅 agent calendar-output tick 強制。

## 相關

- Prompt：[`server/prompts/agent_task.py`](../../server/prompts/agent_task.py)（`build_agent_base_prompt`）
- Channel：`server/agent/channels.py` → `AGENT_CHANNEL` / `channel_from_agent_spec`（tick 內連續；不持久化跨次排程 UI session）
- Policy：`server/domain/agent_task_spec.py`（`project_reconcile`／`web_scout` 預設）
- Schema：見 [`ARCHITECTURE.md` Schema support matrix](../ARCHITECTURE.md#schema-support-matrix)
- UI：任務底下的專案詳情 `/tasks/:taskId/project`（`analysisMode=agent` + `outputCalendar`）；**不是**與 Sources／Assistant 同層的頂層導航。
