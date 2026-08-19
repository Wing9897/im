# 内置助手（Agent + 浏览器语音）

本机文字 Agent＋tools；语音仅为可替换 IO。可查消息／情报、读写用户事件与 recurring＋RRULE；可选联网（非 RAG）。**不做**双向外部日历（Desktop 一次性 ICS／deep-link 除外）、云 STT、FTS5；不创建／改分析任务。

## 怎么用

侧栏 **助手**／命令面板：文字或浏览器 PTT；可选 TTS。纪录：`ui-prefs/assistant/sessions`。语音 `/ai/voice`；联网走 AI 供應商；默认工作集 `__general__`。花名册 `/ai/staff`；A2A／專案調和（Agent tick）见 [`a2a.md`](a2a.md)、[`agent.md`](agent.md)。需已配置 AI Provider；**Electron 不跑浏览器 STT**（用浏览器分頁；会话经 ui-prefs 共用）。

## 架构原则

| 层 | 职责 |
|----|------|
| 前端 Speech adapters | `SttPort` / `TtsPort`；v1 = `BrowserStt` / `BrowserTts` |
| 助手 UI | 文字聊天、PTT、可编辑识别稿、可选朗读、展示 tool 摘要 |
| Agent Runtime | 只认文字；多轮 JSON tool-calling；复用 `ConfigurableLlmClient`；经 `tools_registry` 调度 |
| Tools | 本机 `messages.search`；`intelligence.search_events`；日历读/写；物品 list／create／update／list_expiring；唯读 `worksets.list`；可选 `web.search`（设定门控） |

换 Whisper / 豆包 = 新 Adapter + 设置枚举，**不改** Runtime / Tools。工具由模型在 loop 内自选（**非固定 flow**）。Prompt 字面 SoT：`server/prompts/assistant.py`（`AGENT_SYSTEM_PROMPT`）。装配：`server/agent/runtime.py`。

## HTTP 契约

`POST /api/v1/agent/chat`

请求：

```json
{
  "messages": [{ "role": "user", "content": "最近一星期有没有家庭事务？" }],
  "sessionId": "optional",
  "worksetId": "__general__",
  "llmProfileId": "optional-complete-profile-id"
}
```

- `messages`：`role` 为 `user` | `assistant`（客户端传入的 `system` 会被忽略；服务端注入系统提示）。
- **对话时钟**：客户端**未带** `sessionId`（新对话／点「清空對話」／侧栏「新對話」）时，按本机系统时区采样一次当前时间并写入系统提示；同 `sessionId` 的后续轮次**沿用该时刻**，不每句重取。不写死固定时区。
- 写入 `user_events` 的 `startTime`/`endTime` 会规范为 UTC `...Z`。
- `worksetId`：可选；作为本轮 `calendar.create_event`／`calendar.create_recurring_series` 未显式传 `worksetId` 时的默认归属工作集。`__general__`／空／省略 → builtin 系统工作集「一般」；真实 id 须为已存在的 workset。可选 `taskId` 仅作溯源，不得传 `__general__`。
- `sessionId`：可选；省略时服务端生成新 id，后续多轮可回传以延续会话标识（历史仍由客户端在 `messages` 中带上；本机纪录另存 SQLite `ui-prefs`／`GET/PUT /api/v1/ui-prefs/assistant/sessions`）。
- `llmProfileId`：可选；完整的 `llm_profiles.id`。**有值**时本轮助手／runtime 用该档（须完整）；**省略／空**时硬绑全局助手槽位（`llm_global_slot_assistant`；未绑定 → 400）。A2A 使用独立的 `liaison` 槽位，不借用助手。会话 JSON／`ui-prefs` 仍可持久化同名字段作 per-session 覆盖，但**助手页 UI 不再提供设定档选择器**（已退役 `AssistantSessionLlmProfileSelect`；绑定请到 `/ai/provider` 全局槽位）。任务顾问走 `taskEditor` 全局槽位（见 `/ai/provider`）。
- `surface`／`currentTask`：仅任务创建／编辑页的全局助手请求可带 `surface: "task_editor"` 与当前表单草稿 `currentTask`（见下节）。其他路由与 A2A **不**传。
- **送入模型的上下文压缩（仅助手聊天 Agent）**：服务端在调用 LLM 前按 `agent_history_max_messages`（默认 40）与 `agent_history_max_chars`（默认 48000）省略较旧对话轮次，并插入一行省略提示。UI／SQLite 会话纪录**不裁剪**。可在 **AI 员工介绍 → 助手 LLM** 调整。与「分析调度」无关，也不作用于任务顾问／排行榜分析员／情报任务分析员／后勤 Agent（`analysis_mode=agent` ticks）等其他员工路径。

响应（camelCase）：

```json
{
  "message": "給用戶的最終回答",
  "sessionId": "...",
  "toolCalls": [
    {
      "name": "calendar.upcoming",
      "arguments": { "limit": 20 },
      "resultSummary": "calendar.upcoming: 2 items"
    }
  ],
  "taskConfig": null
}
```

`taskConfig` 可选：仅在任务页助手成功委派顾问（`tasks.consult_advisor`）并得到非空表单补丁时出现。前端：`web/src/api/agent.ts`（`postAgentChat` / `streamAgentChat`）。

#### 错误（真 HTTP 错误码）

200 只代表成功。LLM／运行期失败回标准结构化错误体 `{error_code, message, details, correlation_id}`，映射集中在 `server/api/agent_errors.py`（与 A2A 共用）：

| Status | `error_code` | 情境 |
|--------|--------------|------|
| 400／404 | `VALIDATION_ERROR`／`NOT_FOUND` | 助手槽位未绑定、`llmProfileId` 不存在或设定档不完整 |
| 502 | `ai_engine_failed` | 上游 LLM 呼叫失败 |
| 503 | `ai_engine_unreachable` | 供应商主机连不上（本机 Ollama 未启动、埠号错误） |
| 504 | `agent_timeout` | 整体 wall-clock 逾时 |

前端 `toErrorMessage` 以 `error_code` 查 `web/src/i18n/errorCodes.ts` 取本地化文案。

### 任务页委派任务顾问 + 双头像

仅在路由 `/tasks/new`、`/tasks/:taskId/edit`：

1. **请求闸道**：系统栏快捷对话／空白键语音仍走全局助手 `sendContent`；前端挂载 `taskEditorDraftBridge` 时附带 `surface=task_editor` + `currentTask`。
2. **工具**：仅此时向模型注入 `tasks.consult_advisor`（args：`instruction`）。handler 复用 `AnalysisEngine.consult_task_advisor`；成功则把最后非空 `taskConfig` 挂到 final（非流式与 NDJSON `final` 相同）。未带闸道却调用 → `task_advisor_unavailable`。
3. **写回表单**：`final.taskConfig` → bridge `applyTaskConfig`（与页内右侧任务顾问同一套字段规则）。
4. **UI**：快捷对话 chrome 并排显示助手 + 任务顾问头像；`tasks.consult_advisor` 步骤归因顾问；最终回复泡泡仍是助手。非任务页零改动（仅助手头像）。
5. **不做**：系统栏手动切「以顾问身分发送」、顾问历史并入助手 session、A2A 通道注入顾问工具。页内右侧任务顾问聊天面板入口不变。

### 流式工具步骤（NDJSON）

`POST /api/v1/agent/chat/stream`

请求体与 `/chat` 相同。响应为 `application/x-ndjson`：每行一个 JSON 事件，**不是** LLM token 流式；LLM 仍按轮 `complete` 等待整段 JSON。

设定档解析在串流开始**之前**完成，所以设定错误与「引擎连不上」同样是真 HTTP 错误码（同上表）；状态码送出后才发生的失败只能走下表的 in-band `error` 行。

| `type` | 含义 |
|--------|------|
| `llm_start` | 开始新一轮 LLM 调用（`round` 从 0 起） |
| `tool_start` | 即将执行工具（`name`, `arguments`） |
| `tool_done` | 工具执行完成（含 `resultSummary`） |
| `final` | 最终回答（与 `/chat` 响应同形：`message`, `sessionId`, `toolCalls`） |
| `error` | 串流开始后才发生的失败／逾时（`message` + `error` 码：`ai_engine_unreachable`／`ai_engine_failed`／`agent_timeout`） |

助手 UI 通过 `streamAgentChat` 订阅上述事件，在对话中实时展示工具步骤；最终 `final` 仍写入消息历史。

## Tools

注册 SoT：`server/agent/tools_registry.py`（`BASE_TOOL_HANDLERS` + 条件 `web.search`／`tasks.consult_advisor`）。共用 handler 目录与 MCP allowlist：[`mcp.md`](mcp.md)。A2A 同 handler、`origin=a2a`：[`a2a.md`](a2a.md)。Agent tick 范围／`items.create` 关闭：[`agent.md`](agent.md)。日历 source／kind 与 REST 删除对照：[`ARCHITECTURE.md` Calendar](../ARCHITECTURE.md#calendar-delete-vs-timeline-remove)。

助手通道独有：

- **不受** `mcp_cap_*`／`worksets.external_enabled` 约束（内建助手看全部工作集）。不开放建／删工作集。
- 写入 `user_events.origin=assistant`（客户端不能伪造）。`worksetId` 请求体作为 create 默认归属。
- `surface: "task_editor"` 才注入 `tasks.consult_advisor`。
- `calendar.delete_event` 仍是时间规划 soft-dismiss（**无 restore tool**；恢复仅 UI「顯示已移除」）。MCP 的 `confirm: true` 护栏不套用助手。
- `messages.search`／`intelligence.search_events`：与 REST 同一 LIKE 查询（无 FTS）；省略时间窗默认往前 7 天；默认 20、硬顶 50。

助手所挂 `llm_profiles` 行的 `web_search_enabled` 关闭时既不注入 `web.search` 也不开原生 search。开启时由该档的 `web_search_provider` + 助手 LLM 路由（`server/agent/web_search_routing.py` + `server/web_search/`）。分析管线**不**走助手联网。这不是 RAG。Runtime 最多约 8 轮 tool 调用；模型协议为统一 JSON（见 `AGENT_SYSTEM_PROMPT`）。

## 语音是 IO，不是 Agent

Agent／日历只处理文字。STT→草稿；PTT 松开送出识别文字（空识别不送）。TTS 读最终 `message`。Provider id hard-cut 为 `browser`（无 Whisper／Doubao 占位 id；legacy 存储值归一为 browser）。Electron 桌面壳不跑浏览器 STT（`UnavailableStt`）。

## 明确不做（本阶段）

webcal／CalDAV／OAuth 双向同步（Desktop 一次性 ICS 除外）；OpenClaw 主 Agent；FTS5／RAG；请求级 `allowWebSearch`；创建／改非 recurring 分析任务；助手无 dismiss restore；本机 Whisper／云 STT/TTS；全双工／token streaming。

## 相关代码

`server/api/routes/agent.py` · `server/agent/{runtime,tools_*}` · `server/prompts/assistant.py` · `server/web_search/` · `web/src/api/agent.ts` · `web/src/speech/` · `web/src/pages/ai/assistant/`。

## 测试

Gate：`npm run check`。聚焦：`test_agent_*.py`、`test_web_search*.py`、`test_calendar_*.py`、`test_user_events.py`；FE `web/src/api/agent.test.ts`、`pages/ai/assistant/`、speech／PTT。
