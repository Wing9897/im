[繁體中文](README.md) | [简体中文](README.zh-Hans.md) | [English](README.en.md)

# <img src="docs/images/logo.png" width="32" height="32" alt=""> Intelligence Monitor

Intelligence Monitor 是给**单一家庭**在自己电脑上用的情报工作站：把 Telegram、Discord、RSS、MQTT、Email 等来源收进来，整理成可筛的情报与事件，再落到日历、任务、物品与地图。不是多租户云端服务。

- **个人情报过滤** — 情报事件可按工作集、分析任务、关键字与时段筛选，并切列表／卡片／地图；地图可叠加实时信息与事件、也可只看其中一种，并用 LIVE 时间窗。助手能在同一批本机情报里查问。
- **多任务管理与输出** — 「任务设定」是独立导航（`/tasks`），任务挂在工作集下；情报、排行榜、项目经理、周期任务可分开跑。结果写入情报事件与排行榜；时间规划看月历与甘特。对外是可选的工作集日历分享／发布（[https://subscribe.devents.tech](https://subscribe.devents.tech)），不是一键导出报告。
- **本机家庭工作集** — 资料预设留在本机 SQLite；用工作集把情报、日程与物品归在同一家。AI 供应商与密钥由你自己接。
- **助手随时叫出** — `Ctrl+J`（macOS `⌘+J`）开文字输入；未开时可用「闪现」气泡看语音／快捷回复。完整对话走侧栏「助手」。

## 画面

![月历与当日行程侧栏](docs/images/schedule_calendar.png)

月历与当日行程。

![AI 员工介绍](docs/images/AIstaff_introduce.png)

助手、客户经理与后勤分析角色。

![助手对话](docs/images/chat_page.png)

与助手对话、查情报或改日程。

![情报地图](docs/images/intelligence_map.png)

情报事件落在地图上。

![物品库存](docs/images/item.png)

物品库存与到期。

![分析任务](docs/images/mission.png)

分析任务与监控设置。

## 实际使用

1. **取得应用** — 从 [GitHub Releases](https://github.com/Wing9897/im/releases) 安装 Desktop（Windows／macOS／Linux）。开发或本机跑源代码：

   ```bash
   uv sync --extra dev --locked
   npm ci
   npm run dev
   ```

2. **首次启动** — 建立家庭管理员账号（单一家庭、一组管理员）。Desktop 可选本机当服务（host），或连到已有的远程服务器（client）。
3. **登录** — 之后用同一组账号进入；浏览器会拿装置 session，不必每次贴密钥。
4. **工作集** — 侧栏「工作集」→ 新建，用来归属情报、日程与物品。也可先用内建「一般」（`__general__`）。删掉自建工作集时，底下资料会回到「一般」，「一般」本身不能删。
5. **来源与情报** — 「来源」接 Telegram、Discord、RSS、MQTT、Email 等；「情报事件」看分析结果（列表／卡片／地图），「排行榜」看热门主题。
6. **日历与任务** — 「时间规划」看月历／甘特；「我的日程」管手写行程与周期系列。「任务设定」是**独立导航**（`/tasks`），不是工作集底下的分页，用来设要监控与分析的排程。**周期任务**走独立排程，**RRULE 仅于查询时展开**、**不会触发 AI 分析**。AI 排程支援 10 秒、每小时、每日、每周、自定义秒数。
7. **物品与地图** — 「物品」管库存、到期与提醒。情报事件页可切地图，把带坐标的事件落在图上。
8. **助手** — `Ctrl+J`（macOS `⌘+J`）随时叫出文字输入；未开输入时可用「闪现」气泡看语音／快捷回复（短暂显示后消失，可切「持续」）。完整对话与历史走侧栏「助手」。需先在设置接好 AI 供应商。
9. **设置** — 语言、主题、AI 供应商密钥、通知、外部接口都在设置。账户页可发访问密钥（MCP／A2A 需 scope `*`）。MCP 总开关与能力组在 **设置 → 外部接口 → MCP**。
10. **升级旧库** — 当前是 **schema stamp 7**（`SCHEMA_FLOOR`＝current；生产 `SCHEMA_MIGRATIONS` 为空）。stamp 1–6 **hard-reject**，须备份后 reset。**未来 stamp** 请先**升级应用**。停掉 Desktop／`npm run dev` 后：

    ```bash
    uv run python scripts/reset_local_databases.py --apply
    ```

## 外部 Agent／MCP

任何支持 Streamable HTTP 的外部 Agent 都可连 `{API origin}/api/v1/mcp`（结构化工具，不是聊天）。到账户建立 scope `*` 密钥，再到 **设置 → 外部接口 → MCP** 开总开关与能力组。OpenClaw 只是其中一种客户端。契约：[`docs/agent/mcp.md`](docs/agent/mcp.md)。系统总览：[`docs/TECH.md`](docs/TECH.md)。

要用一句话交办、由本机选工具，走 A2A（`POST /api/v1/a2a/agent`）：[`docs/agent/a2a.md`](docs/agent/a2a.md)。

## 日历分享（可选）

日历分享是可选功能：把工作集日历发到公开来源，别人用链接或账号订阅。

- 公开来源：[https://subscribe.devents.tech](https://subscribe.devents.tech)
- 在本应用：侧栏「订阅」→「日历分享」，填「服务网址」（默认就是上面这个）并登录，再到「我的发布」按「发布工作集」。
- 订阅者到 hub 用链接或账号看公开目录；也可在「搜索订阅」加入。本应用不会在浏览器里直连 hub。

## 开发者

```bash
uv sync --extra dev --locked
npm ci
npm run dev
npm run check
```

Python ≥ 3.11、Node.js ≥ 20.19.0。Windows 若 `C:\Windows\System32\` 有 0-byte 的 `node`／`npm` stub，会盖住真 Node。PR 前跑 `npm run check`（与 CI Ubuntu quality 相同）。`zh-Hant` 为界面文案来源。安全问题走 [`SECURITY.md`](SECURITY.md)，不要开公开 issue。

其余契约：[`docs/README.md`](docs/README.md)。授权 MIT（[`LICENSE`](LICENSE)）。
