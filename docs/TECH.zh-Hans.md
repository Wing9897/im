[繁體中文](TECH.md) | [简体中文](TECH.zh-Hans.md) | [English](TECH.en.md)

# 技术文件

本文件是现行程序的技术总览：进程怎么跑、资料怎么切、谁能打哪些 API。产品说明见 [README](../README.zh-Hans.md)。MCP／A2A 的工具契约与错误码以 [`agent/mcp.md`](agent/mcp.md)、[`agent/a2a.md`](agent/a2a.md) 为准——本文不复制整份工具列表。

## 1. 系统定位与程序

单一家庭、本机优先。预设不是多租户 SaaS，也没有内建 TLS。

| 程序 | 角色 |
|------|------|
| `web/` | React SPA（Vite）。开发时由 Vite 提供；正式环境由 API 程序提供静态文件。 |
| FastAPI | REST `/api/v1/*`、SSE `/api/v1/events`。预设埠 **18820**（`server/constants.py` `SERVICE_PORT`），绑定 `0.0.0.0`（可用 `INTELLIGENCE_MONITOR_HOST` 覆盖）。 |
| Desktop（Electron） | 壳层。`host` 模式在本机拉起 API；`client` 模式只连远程 origin。 |

健康检查（无鉴权）：`GET /api/v1/health`，返回产品版本、`schemaVersion`（整数 stamp）、`schemaSemver`。产品 SemVer（git tag／`VERSION`）与 schema stamp **解耦**。

资料根目录（SQLite、`secret.key`、Telegram sessions）预设：

- Windows：`%APPDATA%/Intelligence Monitor`
- macOS：`~/Library/Application Support/Intelligence Monitor`
- Linux：`$XDG_CONFIG_HOME/Intelligence Monitor` 或 `~/.config/Intelligence Monitor`

可用 `INTELLIGENCE_MONITOR_DATA_DIR`／`INTELLIGENCE_MONITOR_DB` 覆盖。凭证用 Fernet 加密，密钥在 `{DATA_DIR}/secret.key`。详见 [`SECURITY.md`](../SECURITY.md)。

## 2. Schema stamp 7

SoT：`server/db/schema_inspect.py`。

| 常数 | 现值 |
|------|------|
| `CURRENT_SCHEMA_VERSION`／`PRAGMA user_version` | **7** |
| `SCHEMA_FLOOR` | **7**（与 current 相同） |
| `SCHEMA_SEMVER` | `1.6.0`（公开字符串；不是 `user_version`） |
| 生产 `SCHEMA_MIGRATIONS` | **空**（`server/db/schema_steps.py`） |

空库用 `server/db/schema.py` 聚合的 domain DDL 建立，再盖 stamp 7。`FLOOR <= version < CURRENT` 才会走 additive walk——目前 floor＝current，所以这条路径是空的。

启动分类：

- stamp **1–6**：结构对不上现行基线 → **hard-reject**。先把库文件拷出资料目录，再 reset。没有 1→7 的自动升级。
- stamp **> 7**（含已退役的 27／45）：当成**未来 stamp** → hard-reject，讯息要求先**升级应用**；reset 是最后手段。
- 指纹损坏或「长得很像但字段不对」→ hard-reject，并打印 reset 指令。
- 启动**从不**默默删库或重建。

Reset（先停掉 Desktop／`npm run dev`）：

```bash
uv run python scripts/reset_local_databases.py --apply
```

脚本只删已知的 `intelligence_monitor.db` 与 `-wal`／`-shm`，不删备份、`secret.key`、sessions、`connection.json`。重启后才长出现行 stamp。`--apply` **不**自动灌 demo。

## 3. 资料范围

大多数业务行带 `workset_id`。内建系统行 id 为 `__general__`（界面「一般」，`is_system=1`）。建立分析任务、手写事件、物品时若省略工作集，落到 `__general__`。删除自建工作集会先把下属行改指 `__general__`；`__general__` 本身不能删、不能改名。

侧栏「工作集」是 `/worksets`。「任务设定」是**独立路由** `/tasks`（不是工作集底下的分页；旧的 `/tasks/worksets/…` 已移除）。`GET /api/v1/tasks` 只回分析任务；周期日历系列走 `/api/v1/calendar/recurring`，不是任务目录的一行。

工作集另有：

- `notify_enabled`：该集提醒预设
- `external_enabled`：MCP／A2A 是否看得到该集的情报／讯息／物品（预设开；全关则 fail closed）。日历「我的日程」是家庭层，不套这栏。内建助手不受约束。

## 4. 鉴权

单一家庭管理员（`admin_accounts` 单例）＋装置 session＋可撤销访问密钥。

**装置 session**（登录后浏览器使用）：完整读写。建立：`POST /api/v1/setup/register`（首次）或 `/login`；刷新 `/setup/refresh`。账户页可列／撤销装置。

**访问密钥**（`Authorization: Bearer <key>`；SSE 可用 `?token=`）：

| scope | 用途 |
|-------|------|
| `*` | 完整读写。MCP／A2A **必须**。账户 UI 新建密钥只发 `*`。 |
| `read` | 仅 GET／HEAD／OPTIONS。既有只读密钥仍可用，列表显示「只读」。 |

没有更细的密钥 scope（例如 `calendar:write`）。旧的 `a2a:agent`／`a2a:events` 建立时硬拒。能力组 `mcp_cap_*` 与 `worksets.external_enabled` **不是**密钥 scope。

**localhost：** `localhost_auth_exempt` 只在全新安装、第一次 `POST /api/v1/setup/register` 前有效。管理员一旦存在，loopback 也不再豁免，每个请求都要 session 或密钥。忘记密码且没有旧密码：仅 loopback，且须把 Desktop `connection.json` 的 `resetPasswordForLocal` 设为 `true`（成功后服务器会清回 `false`）。

**MCP／A2A 协议面：** 只收 household access key、只要 `*`、**拒绝** device session；loopback 豁免**不适用**。一般 REST（含 `GET /api/v1/mcp/status`）仍可用 session。

远程写入若既不是完整密钥也不是 session，多数路径 403（`/api/v1/viewer/` 除外）。没有内建 TLS；对公网暴露时自己前面加反向代理。

## 5. HTTP API 前缀

业务 API 一律 `/api/v1`。主要分组（完整清单以 OpenAPI／源代码为准）：

| 前缀 | 说明 |
|------|------|
| `/api/v1/setup` | 首次注册、登录、刷新、装置、改密 |
| `/api/v1/worksets` | 工作集 |
| `/api/v1/tasks` | 分析任务（含 templates、activity-spans、agent-ticks） |
| `/api/v1/sources`、`/messages`、`/channels` | 来源与已收讯息 |
| `/api/v1/results` | 情报事件（地图／列表与日历 window 分开） |
| `/api/v1/calendar` | `window`（分析＋手写＋周期＋物品提醒合并）、`user-events`、`recurring`、`imports`（ICS 预览／提交）、dismissals、importance、holidays |
| `/api/v1/items` | 物品 |
| `/api/v1/agent/chat` | 人类助手（本机 tool loop） |
| `/api/v1/a2a/agent` | A2A 自然语言门面（`POST`） |
| `/api/v1/mcp` | MCP Streamable HTTP（ASGI mount，**不**进 OpenAPI） |
| `/api/v1/mcp/status` | 设置页连线测试（session 即可） |
| `/api/v1/calendar-share/*` | 公开 hub 代理（见 §6） |
| `/api/v1/access-keys` | 访问密钥 |
| `/api/v1/events` | SSE |
| `/api/v1/health` | 健康检查（无鉴权） |

MCP：`{API origin}/api/v1/mcp`，只做 Streamable HTTP。设置范例（OpenClaw）与工具 allowlist 见 [`agent/mcp.md`](agent/mcp.md)。A2A 请求形状与错误码见 [`agent/a2a.md`](agent/a2a.md)。两者共用 base tool handlers；MCP **不**在服务器跑 LLM loop。写入溯源：`user_events.origin` 为 `mcp` 或 `a2a`（客户端不可伪造）。

家庭层总开关：`system_config.mcp_enabled`、`a2a_enabled`（预设开，互不控制）。关则对应 HTTP 回 403。同一套 `mcp_cap_*` 过滤 MCP `list_tools`／`call_tool` 与 A2A 内部 tool loop。

## 6. 日历分享

可选。预设公开 origin：`https://subscribe.devents.tech`（`server/calendar_share/constants.py` `DEFAULT_BASE_URL`）。这是独立的公开 hub，**不是**本产品的品牌或必装组件。

本应用只当代理：前端只打 `/api/v1/calendar-share/*`，**不**直连 hub。代理路径包括 session／timezone／profile、publish（依工作集推／撤）、subscriptions、search。凭证与自动同步间隔存在本机 `system_config`；stamp 7 的 `calendar_share_publish` 不再依赖旧 stamp 的 household auto-sync cache 栏。

对 hub 的流量另有 rate limit；路径前缀不走一般 `/api/v1` 的部分 HTTP 限制。没有双向 CalDAV／OAuth 同步；本机可一次性 ICS 导入（`/api/v1/calendar/imports/preview`、`/commit`）。

## 7. 桌面连线

Electron `userData/connection.json`（与服务器读的 `{DATA_DIR}/connection.json` 同一文件名惯例）：

| 字段 | 意义 |
|------|------|
| `mode` | `host`（预设：本机跑 API）或 `client`（连 `serverUrl`） |
| `serverUrl` | client 必填；须为 `http`／`https`。无效则回退 host |
| `resetPasswordForLocal` | 预设 `false`。为 `true` 时允许 loopback 走忘记密码救援；成功后服务器清回 `false` |

壳层加载 URL：host＋正式 → `localhost:18820`；host＋开发 → Vite；client → `serverUrl`。都会带 `?desktop=1`。旧的 LAN bind 旗标读入时丢弃。

## 8. 周期／RRULE

两条线不要混：

**周期日历系列**（`recurring_schedules`，编辑在「我的日程」／`/api/v1/calendar/recurring`）：RFC 5545 RRULE 本体（不要 `RRULE:` 前缀）。**仅于查询时展开**（`GET /api/v1/calendar/window` 与助手／MCP 日历工具）。**不会触发 AI 分析**，也不会建立分析排程 job。暂停用 `is_active`；硬删才拿掉系列行。

**分析任务排程**（`analysis_tasks`，「任务设定」／`/api/v1/tasks`）：具名预设——10 秒、每小时、每日、每周、自定义秒数。内部可能用 RRULE **形状**的字符串给 APScheduler 算下次执行，但那是 trigger 用途，**不会**展开进月历 window。分析任务没有「用日历 RRULE 来排 AI」。

日历 FREQ 允许 DAILY／WEEKLY／MONTHLY／YEARLY。ICS 导入走预览／提交，展开在 Python，不在 React。

## 9. 明确非目标

现行设计不做（或已拿掉）：

- SQLite FTS5／向量 RAG。讯息与情报搜索是 `LIKE`（标题／正文）。
- MCP stdio、SSE-only 旧传输、本机子进程 MCP server。
- 细粒度 access-key scope（能力组 ≠ 密钥 scope）。
- 把分析任务、来源、通知、LLM 设置包成 MCP tools。
- A2A 专用 events CRUD、服务器端多轮 A2A session。
- 应用内 TLS／证书管理。
- 双向外部日历（webcal／CalDAV／OAuth）。一次性 ICS 与可选 hub 代理除外。
- 云端 STT／本机 Whisper 当预设语音栈。
- 启动时默默删库升级旧 stamp 1–6。

## 10. 相关契约

| 文件 | 内容 |
|------|------|
| [README](../README.zh-Hans.md) | 介绍与使用（[繁體](../README.md)、[English](../README.en.md)） |
| [`agent/mcp.md`](agent/mcp.md) | Streamable HTTP、认证、能力组、工具 allowlist |
| [`agent/a2a.md`](agent/a2a.md) | `POST /api/v1/a2a/agent`、liaison 槽、错误码 |
| [`SECURITY.md`](../SECURITY.md) | 威胁模型与漏洞回报 |
| 本页其他语 | [繁體中文](TECH.md)、[English](TECH.en.md) |
