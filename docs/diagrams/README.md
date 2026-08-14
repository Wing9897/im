# System structure diagrams

High-level Mermaid views of Intelligence Monitor: **Input → Process → Output**, the **three AI analysis modes** (`leaderboard` / `intel_event` / `agent`), the schedule timer, and the project-reconcile feedback loop.

**`recurring` is not an `analysis_mode`.** Standalone RRULE series live on `recurring_schedules` and expand at query time only — they never enter the AI scheduler dispatch path.

Contract detail stays in [`ARCHITECTURE.md`](../ARCHITECTURE.md) and [`agent/agent.md`](../agent/agent.md)（產品預設「專案調和」；URL 僅 `/tasks/:taskId/agent`）.

## 1. Big picture (Input → Process → Output + calendar side-channel)

```mermaid
flowchart TB
  subgraph INPUT["Input — collected sources"]
    TG[Telegram]
    DC[Discord]
    RSS[RSS]
    MQTT[MQTT]
    EM[Email IMAP]
    HTTP[HTTP poll]
    TG & DC & RSS & MQTT & EM & HTTP --> MSG[(messages)]
  end

  subgraph SIDE["Not source Input — calendar writes"]
    direction TB
    NOTE["user_events / recurring expansions<br/>are NOT collector ingress"]
    MAN[User manual UI / REST]
    AST[Assistant Agent tools]
    A2A[A2A Account-manager Agent]
    MCP[MCP tool channel]
    MAN & AST & A2A & MCP --> UE[(user_events)]
  end

  subgraph TIMER["Schedule timer — big cycle"]
    AP[APScheduler<br/>interval / cron]
    AP -->|"leaderboard / intel_event / agent<br/>(if active & not paused)"| DISPATCH
  end

  subgraph PROCESS["Process — analysis_tasks (3 AI modes)"]
    DISPATCH{Task mode?}
    DISPATCH -->|leaderboard| LB[execute_batch<br/>oneshot JSON]
    DISPATCH -->|intel_event| EV[execute_batch<br/>oneshot JSON]
    DISPATCH -->|agent| AG[execute_agent_tick<br/>policy-driven Agent]
    MSG --> TC[task_channels bind]
    TC --> LB & EV
    TC -.->|"cursor / threshold / optional"| AG
  end

  subgraph CAL["Calendar domain — not analysis_mode"]
    RC[recurring_schedules<br/>RRULE expand at read]
    RC --> OCC[RRULE occurrences]
  end

  subgraph OUTPUT["Output — consume & act"]
    LB --> TOP[(leaderboard topics)]
    EV --> AE[(analysis_events)]
    AG -->|"output_analysis_events"| AE
    AG -->|"output_calendar"| UE
    AG -->|"output_calendar"| CHILD[child recurring rows]
    TOP & AE --> UI[Intelligence / Timeline / Board]
    UE & OCC & CHILD --> UI
    AE & TOP --> ACT[Actions / webhooks / voice]
  end

  SIDE -.-> UI
  CAL -.-> UI
```

## 2. Three AI modes (who schedules, who reads messages)

AI modes are the only `analysis_tasks.analysis_mode` values. Calendar recurrence is a separate domain.

```mermaid
flowchart LR
  subgraph AI["AI — schedulable analysis_mode"]
    L[leaderboard<br/>batch LLM]
    E[intel_event<br/>batch LLM]
    A[agent<br/>AgentTaskSpec tick]
  end

  subgraph CAL["Calendar — not analysis_mode"]
    R[recurring_schedules<br/>RRULE only]
  end

  MSG[(messages via task_channels)] --> L & E
  MSG -.->|"cursor required / threshold optional / schedule optional"| A
  R -.->|"query-time expand"| CALUI[Timeline calendar / gantt]
  L --> OUT1[topics]
  E --> OUT2[analysis_events]
  A -->|"web_scout-like"| OUT2
  A -->|"project_reconcile-like"| OUT3[user_events + child recurring]
```

| Mode / domain | Scheduler | Reads `messages`? | Typical output |
|---------------|-----------|-------------------|----------------|
| `leaderboard` (`analysis_mode`) | Yes (`execute_batch`) | Yes | Leaderboard topics |
| `intel_event` (`analysis_mode`) | Yes (`execute_batch`) | Yes | `analysis_events` |
| `agent` (`analysis_mode`) | Yes (`execute_agent_tick`) | Depends on `trigger_mode` (cursor / threshold / schedule) | `user_events` and/or `analysis_events` per `AgentTaskSpec` |
| Standalone `recurring` series | **No** (not an analysis mode) | No | RRULE occurrences at read |

## 3. Schedule timer (the big scanner loop)

```mermaid
flowchart TB
  START([Server start / resume]) --> REG[Register jobs for active<br/>schedulable tasks]
  REG --> WAIT[Wait next fire<br/>10s / hourly / daily / weekly / custom]
  WAIT --> PAUSE{analysis_paused<br/>or emergency stop?}
  PAUSE -->|yes| WAIT
  PAUSE -->|no| ACTIVE{Task still active?}
  ACTIVE -->|no| WAIT
  ACTIVE -->|yes| MODE{analysis_mode}
  MODE -->|leaderboard / intel_event| BATCH[execute_batch]
  MODE -->|agent| TICK[execute_agent_tick]
  BATCH --> DONE[Batch completed / retry]
  TICK --> DONE
  DONE --> WAIT
```

Global pause / emergency stop and per-task disable stop **new** work; agent cursor drain also re-checks before **each wave**. Recurring series never register here.

## 4. Project reconcile feedback loop (closed-loop)

Only `analysis_mode=agent` with calendar output (`output_calendar` / project_reconcile preset). Other AI modes stay open-loop (batch／agent findings → results, no tool writes back into the calendar).

```mermaid
flowchart TB
  FIRE([Schedule fire]) --> CUR[Load message cursor]
  CUR --> Q{New messages since cursor?}
  Q -->|0| SKIP[Skip LLM<br/>batch: skipped no new messages]
  SKIP --> NEXT([Wait next schedule])
  Q -->|yes| WAVE[Agent wave<br/>≤40 msgs]
  WAVE --> SYS[System pinned:<br/>agent prompt + task goals]
  SYS --> TOOLS[Tools: calendar.* / messages.search<br/>scoped to this project]
  TOOLS --> WRITE[Create / update / hard-delete<br/>user_events + child recurring series]
  WRITE --> ADV[Advance cursor]
  ADV --> MORE{More backlog?}
  MORE -->|yes| STOP{Paused / task off /<br/>optional wave cap?}
  STOP -->|no| WAVE
  STOP -->|yes| DEFER[Defer remaining → next fire]
  MORE -->|no| DRAINED[Queue drained]
  DEFER --> NEXT
  DRAINED --> NEXT

  WRITE -.->|"feeds Timeline / Board"| OUT[Output surfaces]
  OUT -.->|"user may edit manually"| WRITE
```

Within one fire: waves share one continuing session (compacted history; system + goals stay pinned). The next schedule fire starts a **new** session if there is new backlog.

## Related

- [`ARCHITECTURE.md` Core design](../ARCHITECTURE.md#core-design-task-as-universal-interface)
- [`agent/agent.md`](../agent/agent.md)
- Root overview: [`../../README.md`](../../README.md)
