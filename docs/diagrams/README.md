# System structure diagrams

High-level Mermaid views of Intelligence Monitor: **Input → Process → Output**, the five task modes, the schedule timer, and the project-manager feedback loop.

Contract detail stays in [`ARCHITECTURE.md`](../ARCHITECTURE.md) and [`agent/project.md`](../agent/project.md).

## 1. Big picture (Input → Process → Output + calendar side-channel)

```mermaid
flowchart TB
  subgraph INPUT["Input — collected sources"]
    TG[Telegram]
    DC[Discord]
    RSS[RSS]
    MQTT[MQTT]
    EM[Email IMAP]
    TG & DC & RSS & MQTT & EM --> MSG[(messages)]
  end

  subgraph SIDE["Not source Input — calendar writes"]
    direction TB
    NOTE["user_events / recurring expansions<br/>are NOT collector ingress"]
    MAN[User manual UI / REST]
    AST[Assistant Agent tools]
    A2A[A2A Account-manager Agent]
    MAN & AST & A2A --> UE[(user_events)]
  end

  subgraph TIMER["Schedule timer — big cycle"]
    AP[APScheduler<br/>interval / cron]
    AP -->|"leaderboard / event / project<br/>(if active & not paused)"| DISPATCH
  end

  subgraph PROCESS["Process — analysis_tasks × 4"]
    DISPATCH{Task mode?}
    DISPATCH -->|leaderboard| LB[execute_batch<br/>oneshot JSON]
    DISPATCH -->|event| EV[execute_batch<br/>oneshot JSON]
    DISPATCH -->|project| PM[execute_project_tick<br/>closed-loop Agent]
    DISPATCH -.->|recurring| RC[No LLM<br/>RRULE expand at read]
    MSG --> TC[task_channels bind]
    TC --> LB & EV & PM
  end

  subgraph OUTPUT["Output — consume & act"]
    LB --> TOP[(leaderboard topics)]
    EV --> AE[(analysis_events)]
    PM --> UE
    PM --> CHILD[child recurring rows]
    RC --> OCC[RRULE occurrences]
    TOP & AE --> UI[Intelligence / Timeline / Board]
    UE & OCC & CHILD --> UI
    AE & TOP --> ACT[Actions / webhooks / voice]
  end

  SIDE -.-> UI
```

## 2. Four task modes (who schedules, who reads messages)

```mermaid
flowchart LR
  subgraph AI["AI — schedulable"]
    L[leaderboard<br/>batch LLM]
    E[event<br/>batch LLM]
    P[project<br/>Agent tick]
  end

  subgraph NOAI["No LLM — not AI-scheduled"]
    R[recurring<br/>RRULE only]
  end

  MSG[(messages via task_channels)] --> L & E & P
  R -.->|"query-time expand"| CAL[Timeline calendar / gantt]
  L --> OUT1[topics]
  E --> OUT2[analysis_events]
  P --> OUT3[user_events + child recurring]
```

| Mode | Scheduler | Reads `messages`? | Typical output |
|------|-----------|-------------------|----------------|
| `leaderboard` | Yes (`execute_batch`) | Yes | Leaderboard topics |
| `event` | Yes (`execute_batch`) | Yes | `analysis_events` |
| `project` | Yes (`execute_project_tick`) | Yes (cursor + drain) | Owned `user_events` + child `recurring` |
| `recurring` | No | No | RRULE occurrences at read |

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
  MODE -->|leaderboard / event| BATCH[execute_batch]
  MODE -->|project| TICK[execute_project_tick]
  BATCH --> DONE[Batch completed / retry]
  TICK --> DONE
  DONE --> WAIT
```

Global pause / emergency stop and per-task disable stop **new** work; project drain also re-checks before **each wave**.

## 4. Project manager feedback loop (closed-loop)

Only `analysis_mode=project`. Other AI modes stay open-loop (batch → results, no tool writes back into the calendar).

```mermaid
flowchart TB
  FIRE([Schedule fire]) --> CUR[Load message cursor]
  CUR --> Q{New messages since cursor?}
  Q -->|0| SKIP[Skip LLM<br/>batch: skipped no new messages]
  SKIP --> NEXT([Wait next schedule])
  Q -->|yes| WAVE[Agent wave<br/>≤40 msgs]
  WAVE --> SYS[System pinned:<br/>project prompt + task goals]
  SYS --> TOOLS[Tools: calendar.* / messages.search<br/>scoped to this project]
  TOOLS --> WRITE[Create / update / soft-delete<br/>user_events + child recurring]
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
- [`agent/project.md`](../agent/project.md)
- Root overview: [`../../README.md`](../../README.md)
