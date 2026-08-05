# 内置助手（Agent + 浏览器语音）

本机文字 Agent＋tools；语音仅为可替换 IO。可查消息／情报、读写用户事件与 recurring＋RRULE；可选联网（非 RAG）。**不做**双向外部日历（Desktop 一次性 ICS／deep-link 除外）、云 STT、FTS5；不创建／改分析任务。

## 怎么用

侧栏 **助手**／命令面板：文字或浏览器 PTT；可选 TTS。纪录：`ui-prefs/assistant/sessions`。语音 `/ai/voice`；联网走 AI 供應商；默认工作集 `__user__`。花名册 `/ai/staff`；A2A／项目见 [`a2a.md`](a2a.md)、[`project.md`](project.md)。需已配置 AI Provider；**Electron 不跑浏览器 STT**（用浏览器分頁；会话经 ui-prefs 共用）。

## 架构原则

| 层 | 职责 |
|----|------|
| 前端 Speech adapters | `SttPort` / `TtsPort`；v1 = `BrowserStt` / `BrowserTts` |
| 助手 UI | 文字聊天、PTT、可编辑识别稿、可选朗读、展示 tool 摘要 |
| Agent Runtime | 只认文字；多轮 JSON tool-calling；复用 `ConfigurableLlmClient`；经 `tools_registry` 调度 |
| Tools | 本机 `messages.search`；`intelligence.search_events`；日历读/写；可选 `web.search`（设定门控） |

换 Whisper / 豆包 = 新 Adapter + 设置枚举，**不改** Runtime / Tools。

工具选择由模型在 loop 内自选（**非固定 flow**）。Prompt 要求 local-first；总闸 `assistant_web_search_enabled` 关闭时既不注入 `web.search` 也不开原生 search。开启时由 `web_search_provider` + 助手 LLM 路由（见下「联网搜索」）。

## HTTP 契约

`POST /api/v1/agent/chat`

请求：

```json
{
  "messages": [{ "role": "user", "content": "最近一星期有没有家庭事务？" }],
  "sessionId": "optional",
  "worksetId": "__user__"
}
```

- `messages`：`role` 为 `user` | `assistant`（客户端传入的 `system` 会被忽略；服务端注入系统提示）。
- **对话时钟**：客户端**未带** `sessionId`（新对话／点「清空對話」／侧栏「新對話」）时，按本机系统时区采样一次当前时间并写入系统提示；同 `sessionId` 的后续轮次**沿用该时刻**，不每句重取。不写死固定时区。
- 写入 `user_events` 的 `startTime`/`endTime` 会规范为 UTC `...Z`。
- `worksetId`：可选；作为本轮 `calendar.create_event` 未显式传 `worksetId` 时的默认归属工作集。`__user__`／空／省略 → builtin 系统工作集「一般」；真实 id 须为已存在的 workset。可选 `taskId` 仅作溯源，不得传 `__user__`。
- `sessionId`：可选；省略时服务端生成新 id，后续多轮可回传以延续会话标识（历史仍由客户端在 `messages` 中带上；本机纪录另存 SQLite `ui-prefs`／`GET/PUT /api/v1/ui-prefs/assistant/sessions`）。
- `surface`／`currentTask`：仅任务创建／编辑页的全局助手请求可带 `surface: "task_editor"` 与当前表单草稿 `currentTask`（见下节）。其他路由与 A2A **不**传。
- **送入模型的上下文压缩（仅 Agent）**：服务端在调用 LLM 前按 `agent_history_max_messages`（默认 40）与 `agent_history_max_chars`（默认 48000）省略较旧对话轮次，并插入一行省略提示。UI／SQLite 会话纪录**不裁剪**。可在 **AI 员工介绍 → 助手 LLM** 调整。与「分析调度」无关，也不作用于任务编辑／排行榜／事件情报。

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

`taskConfig` 可选：仅在任务页助手成功委派顾问（`tasks.consult_advisor`）并得到非空表单补丁时出现。LLM 不可用时仍返回上述形状，`message` 为友好错误文案，并可能带 `error` 字段。前端：`web/src/api/agent.ts`（`postAgentChat` / `streamAgentChat`）。

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

| `type` | 含义 |
|--------|------|
| `llm_start` | 开始新一轮 LLM 调用（`round` 从 0 起） |
| `tool_start` | 即将执行工具（`name`, `arguments`） |
| `tool_done` | 工具执行完成（含 `resultSummary`） |
| `final` | 最终回答（与 `/chat` 响应同形：`message`, `sessionId`, `toolCalls`） |
| `error` | 降级/超时（仍可能带 `message`, `error`） |

助手 UI 通过 `streamAgentChat` 订阅上述事件，在对话中实时展示工具步骤；最终 `final` 仍写入消息历史。

## Tools

统一注册：`server/agent/tools_registry.py`（合并 calendar / messages / intelligence / items / 条件性 web／条件性 tasks）。

### 物品（trackable items）

实现：`server/agent/tools_items/`。与 REST `/api/v1/items` 同一服务层；购入／到期／提醒日投影走统一 `GET /api/v1/calendar/items`（`source=item`，`itemDateKind`=`purchased`｜`expires`｜`remind`），勿另开双轨。

| Tool | 行为 | 限额 |
|------|------|------|
| `items.list_expiring` | 列出即将到期／已过期的 active 物品（相对「今天」+ `days` 窗） | 默认合理上限，见 handler |
| `items.create` | 创建物品（可选分类／到期日／attributes；空 remind 时套分类 `defaultRemindBeforeDays`） | 1 条 |

### 任务顾问（仅任务编辑 surface）

实现：`server/agent/tools_tasks.py`。闸道：`surface == "task_editor"` 时 `task_advisor_enabled=True`（对齐 `web_search_enabled` 条件注入）。

| Tool | 行为 | 限额 |
|------|------|------|
| `tasks.consult_advisor` | 将自然语言 `instruction` + 请求体 `currentTask` 交给既有任务顾问引擎；回传 `{ message, taskConfig }` | 本轮可多次；final 取最后非空 `taskConfig` |

### 本机消息

共享查询：`server/queries/messages_queries.py`（与 `GET /api/v1/messages/page` 同一 LIKE 过滤，无 FTS）。实现：`server/agent/tools_messages.py`。

| Tool | 行为 | 限额 |
|------|------|------|
| `messages.search` | 本机消息 LIKE 搜索（content / sender / channel）；省略 `timeRange` 默认 **7d**（往前 7 天含今天）；仅 `all` 表示全库；用户说「今天」用 `today` | 默认 20，硬顶 50（无论时间窗） |

返回精简字段：`id`, `platform`, `channelName`, `senderName`, `content`（截断）, `timestamp`（不含 rawData/media）；另回传实际 `timeRange`。

### 情报／关键事件

共享查询：`server/queries/results_queries.py` → `query_analysis_events`（与情报页 REST 同一 LIKE／筛选，无 FTS）。实现：`server/agent/tools_intelligence.py`。

| Tool | 行为 | 限额 |
|------|------|------|
| `intelligence.search_events` | 分析产出的关键事件（含**无时间**）；可选 `query`／`taskId`／日期／`hasTime`／`allTime`；省略 query 则列近期；省略日期且非 `allTime` 时自动加 **往前 7 天**下界；`allTime=true` 或 `timeRange=all` 跳过默认窗；用户说「今天」传当日 `startDate`／`endDate` | 默认 20，硬顶 50（无论时间窗） |

返回精简字段：`id`, `taskId`, `taskName`, `title`, `body`（截断）, `startTime`, `endTime`, `location`, `createdAt`, `sourcePlatform`, `sourceChannelName`, `dismissed`（时间规划 soft-dismiss 标记；情报仍列出）；另回传实际 `startDate`／`endDate`／`allTime`。

与 `calendar.*` 的差别：calendar 是时间轴／排程视角（analysis + RRULE + user）；本 tool 只读 `analysis_events`，覆盖情报页「全部关键事件」。

### 日历

统一查询层：`server/calendar/query.py`（合并 analysis + RRULE + `user_events`；与 `GET /api/v1/calendar/items` 共用 RRULE 展开；ISO 解析见 `server/time_iso.py`）。用户事件写入：`server/user_events.py`（与 `GET/POST/PATCH/DELETE /api/v1/calendar/user-events` 同一服务层）。工具实现：`server/agent/tools_calendar/`（`handlers.py` 逻辑、`schemas.py` LLM schema、`__init__.py` 对外入口）；写入规则与 REST 共用 `server/services/task_writes.py`。

| Tool | 行为 | 限额 |
|------|------|------|
| `calendar.list_calendars` | 可查询的任务/日历元数据（无事件体） | 全量元数据 |
| `calendar.upcoming` | 从服务端「现在」起的未来事件；相对时间用 `days`（如 7） | 默认 20，硬顶 100 |
| `calendar.recent` | 过去事件摘要 | 默认 20，硬顶 100 |
| `calendar.window` | 绝对日期窗 `start`+`end`；**勿**用它拼「未來 N 天」（易漏时区） | 默认 50，硬顶 100 |
| `calendar.get` | 按事件 id 取详情（含用户事件） | 1 条 |
| `calendar.create_event` | 创建单次用户事件（服务端固定 `origin=assistant`）；必填 `title`+`startTime`；可选 `worksetId`（否则用请求体默认 `worksetId`）；可选 `taskId` 溯源（禁止 `__user__`） | 1 条 |
| `calendar.create_recurring_task` | **新建** `analysisMode=recurring` 任务＋RRULE（周期任务）；必填 `rrule`＋`name`/`title`；非全日需 `eventStartTime`（系统本地 `HH:MM`）；展开后 wire 为 UTC；不碰其他模式 | 1 条 |
| `calendar.update_recurring_task` | **更新**既有 recurring 任务（name／rrule／时钟／地点／描述／`isActive`）；`isActive` 主要用于再启用；停用优先 `delete_recurring_task`；拒绝非 recurring 模式 | 1 条 |
| `calendar.delete_recurring_task` | **软删除／停用**既有 recurring 任务（优先入口；`isActive=false`，系列行保留，可再 `update_recurring_task` 设 `isActive=true` 重啟）；拒绝非 recurring 模式 | 1 条 |
| `calendar.update_event` | 更新用户事件（勿用于 analysis / RRULE）；可选改 `worksetId`（归属）／`taskId`（溯源，禁止 `__user__`） | 1 条 |
| `calendar.delete_event` | 时间规划 soft-dismiss（用户／分析／RRULE 单次）；源行保留，仅时间规划隐藏；情报页分析事件仍可见；**恢复仅 UI**（「顯示已移除」），助手无 restore tool | 1 条 |

列表字段：`id`, `taskId`, `title`, `startTime`, `endTime`, `location?`, `source`（`analysis` / `recurring` / `user`）；用户事件另带 `origin`、`worksetId`（归属；builtin `__user__`＝「一般」）以及可选溯源 `taskId`（空＝无任务溯源，**不是**「一般」工作集）。

来源边界由服务端决定：普通 REST/UI 创建固定为 `origin=manual`，助手通道 `calendar.create_event` 固定为 `origin=assistant`，专案 tick 通道固定为 `origin=project`，A2A 通道工具写入固定为 `origin=a2a`；客户端不能借由请求字段伪造来源。详见 [`a2a.md`](a2a.md)／[`project.md`](project.md)。

可选参数（upcoming / recent / window）：`search`（标题/地点过滤）、`taskId`（按分析任务过滤：analysis／RRULE 该任务 **加上** `user_events.task_id` 溯源匹配行；**勿**传 `__user__`——那是工作集 id，列表过滤会拒绝）。归属筛选用写入／UI 的 `worksetId`／`sourceFilter.worksetIds`，不是 `taskId=__user__`。语义过滤由模型选 tool + 传 `search` / 任务名完成。

### 联网搜索（可选）

实现：`server/agent/web_search_routing.py`（路由）+ `server/agent/tools_web_search.py` + `server/web_search/` + OpenAI Responses／Gemini grounding（原生路径）。设定键：

- `assistant_web_search_enabled`（默认 `true`）— **总闸**：关闭则不注入 `web.search`，也不开启供应商原生 search tools
- `web_search_provider`：
  - `auto`（默认）— 跟当前助手／聊天 LLM：
    - OpenAI（官方 `api.openai.com`）→ Responses API 原生 `web_search`，**不**注入自研 `web.search`
    - Gemini（官方 `generativelanguage.googleapis.com`）→ Google Search grounding；非官方基址则诚实回退 DDG／Brave 工具并在设定 UI 提示
    - 其他（Ollama／OpenRouter／compatible 非官方）→ 自研 `web.search` + DuckDuckGo（可选手动 Brave）
  - `duckduckgo` / `brave` — **强制**工具路径（忽略原生）
- Brave key 未配置时 tool 返回明确 error
- 分析管线（event／leaderboard 等）**不**走助手联网

| 路径 | 行为 | 限额／备注 |
|------|------|------|
| OpenAI 原生 | Responses `tools: [{type: web_search}]` | 由 OpenAI 托管；本机 tools 仍用 JSON 协议 |
| Gemini 原生 | `generateContent` + `tools: [{google_search: {}}]` | 官方基址；失败／非官方 → 工具回退 |
| `web.search` | 外部网页检索；统一 `{ items: [{ title, url, snippet }], provider, count }` | 默认 5，硬顶 8 |

DuckDuckGo：Instant Answer JSON（`api.duckduckgo.com`），空结果时再试 lite HTML（固定 host + `validate_outbound_url`）。**不**引入 `duckduckgo-search` 包；结果质量通常弱于 Brave。这是可选检索，**不是** RAG／向量库。

Runtime 最多约 8 轮 tool 调用；模型协议为统一 JSON（非各厂商原生 function-calling）：

- 调工具：`{"tool_calls":[{"name":"...","arguments":{...}}]}`
- 最终答：`{"message":"..."}`

系统提示要求：local-first（先 messages／intelligence／calendar）；「今天／今日」必须用当日时间窗（`timeRange=today` 或当日日期）；未指定时间可省略（服务端默认 7 天），禁止把 7 天／全库结果说成「今日」；要全部历史用 `all`／`allTime` 并标明范围；创建用户事件前自然语言确认；口语、先结论后要点；区分本机与网络来源；单次罗列不超过约 10 条。

## 语音是 IO，不是 Agent

Agent／日历只处理文字。STT→草稿；PTT 松开送出识别文字（空识别不送）。TTS 读最终 `message`。Provider id hard-cut 为 `browser`（无 Whisper／Doubao 占位 id；legacy 存储值归一为 browser）。Electron 桌面壳不跑浏览器 STT（`UnavailableStt`）。

## 明确不做（本阶段）

webcal／CalDAV／OAuth 双向同步（Desktop 一次性 ICS 除外）；OpenClaw 主 Agent；FTS5／RAG；请求级 `allowWebSearch`；创建／改非 recurring 分析任务；助手无 dismiss restore；本机 Whisper／云 STT/TTS；全双工／token streaming。

## 相关代码

`server/api/routes/agent.py` · `server/agent/{runtime,tools_*}` · `server/web_search/` · `server/calendar/` · `web/src/api/agent.ts` · `web/src/domain/assistant/` · `web/src/speech/` · `web/src/hooks/assistantPtt/` · `web/src/pages/ai/assistant/` · `SettingsVoicePage`／`SettingsAiProviderPage`。

## 测试

Gate：`npm run check`。聚焦：`test_agent_*.py`、`test_web_search*.py`、`test_calendar_*.py`、`test_user_events.py`；FE `web/src/api/agent.test.ts`、`pages/ai/assistant/`、speech／PTT。
