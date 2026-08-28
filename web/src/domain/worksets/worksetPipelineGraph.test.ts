import { describe, expect, it } from "vitest";

import {
  PIPELINE_BLOCK,
  PIPELINE_PAGE,
  PIPELINE_LAYER_PORT,
  PIPELINE_VISIBLE_POINTS,
  buildWorksetPipelineGraph,
  collapsePipelineGraph,
  itemPointId,
  pipelinePointHandleTop,
  scopePipelineInputToWorkset,
  sourcePointId,
  taskIntelEnabled,
  taskPointId,
  worksetPointId,
  type PipelineGraphInput,
  type PipelineGraphLabels,
} from "./worksetPipelineGraph";

const labels: PipelineGraphLabels = {
  generalName: "一般",
  unassigned: "未歸屬",
  more: (count) => `另 ${count} 項`,
  assistant: "助手",
  timeline: "時間規劃",
  intel: "情報頁",
  notify: "本機通知",
  external: "動作",
};

describe("worksetPipelineGraph", () => {
  it("lists workset and task points and wires a task to its owning workset", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [
        { id: "__general__", name: "一般", notifyEnabled: true, externalEnabled: true },
        { id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true },
      ],
      tasks: [
        {
          id: "t1",
          name: "Scan",
          worksetId: "ws-1",
          outputAnalysisEvents: true,
          includeInTimeline: false,
          outputCalendar: false,
          notifyPref: "off",
        },
      ],
      items: [],
      sources: [],
      events: [],
      labels,
    });

    const worksets = graph.blocks.find((block) => block.kind === "worksets");
    const tasks = graph.blocks.find((block) => block.kind === "tasks");
    expect(worksets?.points.map((point) => point.entityId)).toEqual(["__general__", "ws-1"]);
    expect(tasks?.points.map((point) => point.entityId)).toEqual(["t1"]);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: taskPointId("t1"),
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === taskPointId("t1") &&
          (edge.targetPointId === "page:intel" ||
            edge.targetPointId === "page:timeline" ||
            edge.targetPointId === "page:notify"),
      ),
    ).toBe(false);
    expect(tasks?.points[0]?.gates).toEqual([
      { kind: "calendar", on: false, toggleable: true },
      { kind: "notify", on: false, toggleable: true },
      { kind: "intel", on: true, toggleable: true },
    ]);
  });

  it("dims the intel icon when outputAnalysisEvents is off instead of muting a wire", () => {
    expect(taskIntelEnabled({ id: "a", name: "a", outputAnalysisEvents: true })).toBe(true);
    expect(taskIntelEnabled({ id: "a", name: "a" })).toBe(true);
    expect(taskIntelEnabled({ id: "a", name: "a", outputAnalysisEvents: false })).toBe(false);
    expect(
      taskIntelEnabled({
        id: "lb",
        name: "Board",
        analysisMode: "leaderboard",
        outputAnalysisEvents: true,
      }),
    ).toBe(false);

    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [
        { id: "on", name: "On", worksetId: "ws-1", outputAnalysisEvents: true, notifyPref: "off" },
        { id: "off", name: "Off", worksetId: "ws-1", outputAnalysisEvents: false, notifyPref: "off" },
      ],
      items: [],
      sources: [],
      events: [],
      labels,
    });

    const gatesOf = (id: string) =>
      graph.blocks.find((block) => block.kind === "tasks")?.points.find((point) => point.entityId === id)?.gates;
    expect(gatesOf("on")?.find((gate) => gate.kind === "intel")).toEqual({
      kind: "intel",
      on: true,
      toggleable: true,
    });
    expect(gatesOf("off")?.find((gate) => gate.kind === "intel")).toEqual({
      kind: "intel",
      on: false,
      toggleable: true,
    });
    expect(
      graph.edges.some(
        (edge) => edge.sourcePointId.startsWith("task:") && edge.targetPointId === "page:intel",
      ),
    ).toBe(false);
  });

  it("does not put an intel icon on leaderboard tasks; notify is an icon", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [
        {
          id: "lb",
          name: "Board",
          analysisMode: "leaderboard",
          worksetId: "ws-1",
          outputAnalysisEvents: true,
          notifyPref: "inherit",
        },
      ],
      items: [],
      sources: [],
      events: [],
      labels,
    });

    const lbGates = graph.blocks
      .find((block) => block.kind === "tasks")
      ?.points.find((point) => point.entityId === "lb")?.gates;
    expect(lbGates?.some((gate) => gate.kind === "intel")).toBe(false);
    expect(lbGates?.some((gate) => gate.kind === "calendarWrite")).toBe(false);
    expect(lbGates?.find((gate) => gate.kind === "notify")).toEqual({
      kind: "notify",
      on: true,
      toggleable: true,
    });
    expect(
      graph.edges.find(
        (edge) => edge.sourcePointId === taskPointId("lb") && edge.targetPointId === "page:intel",
      ),
    ).toBeUndefined();
    expect(
      graph.edges.some(
        (edge) => edge.sourcePointId === taskPointId("lb") && edge.targetPointId === "page:notify",
      ),
    ).toBe(false);
  });

  it("wires source accounts to subscribed tasks via task_channels", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [
        {
          id: "t1",
          name: "Scan",
          worksetId: "ws-1",
          outputAnalysisEvents: false,
          notifyPref: "off",
          channelIds: ["telegram:42"],
        },
      ],
      items: [],
      sources: [{ id: "src-1", name: "News" }],
      channels: [{ channelId: "telegram:42", sourceId: "src-1" }],
      events: [],
      labels,
    });

    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: sourcePointId("src-1"),
        targetPointId: taskPointId("t1"),
      }),
    );
  });

  it("does not route items or calendar through the task block", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [{ id: "t1", name: "Scan", worksetId: "ws-1", outputAnalysisEvents: false, notifyPref: "off" }],
      items: [{ id: "item-1", title: "Milk", worksetId: "ws-1" }],
      sources: [],
      events: [
        { id: "ev-cal", title: "Standup", worksetId: "ws-1" },
        { id: "ev-exp", title: "Milk expires", worksetId: "ws-1", itemId: "item-1", kind: "expires" },
      ],
      labels,
    });

    expect(graph.blocks.find((block) => block.kind === "itemEvents")).toBeUndefined();
    expect(graph.blocks.find((block) => block.id === "block-calendar")).toBeUndefined();
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: itemPointId("item-1"),
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: taskPointId("t1"),
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges.some((edge) => edge.sourcePointId.startsWith("itemEvent:"))).toBe(false);
    expect(graph.edges.some((edge) => edge.targetPointId.startsWith("itemEvent:"))).toBe(false);
    expect(graph.edges.some((edge) => edge.sourcePointId.startsWith("calendar:"))).toBe(false);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId.startsWith("task:") &&
          (edge.targetPointId.startsWith("item:") || edge.targetPointId.startsWith("itemEvent:")),
      ),
    ).toBe(false);
  });

  it("adds a toggleable calendar-write icon on agent tasks only", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [
        {
          id: "agent-on",
          name: "Reconcile",
          analysisMode: "agent",
          worksetId: "ws-1",
          outputAnalysisEvents: true,
          includeInTimeline: true,
          outputCalendar: true,
          notifyPref: "off",
        },
        {
          id: "agent-off",
          name: "Scout",
          analysisMode: "agent",
          worksetId: "ws-1",
          outputAnalysisEvents: true,
          includeInTimeline: true,
          outputCalendar: false,
          notifyPref: "off",
        },
        {
          id: "intel-1",
          name: "Scan",
          analysisMode: "intel_event",
          worksetId: "ws-1",
          outputAnalysisEvents: true,
          includeInTimeline: true,
          outputCalendar: true,
          notifyPref: "off",
        },
        {
          id: "lb-1",
          name: "Board",
          analysisMode: "leaderboard",
          worksetId: "ws-1",
          outputAnalysisEvents: true,
          includeInTimeline: true,
          outputCalendar: true,
          notifyPref: "inherit",
        },
      ],
      items: [],
      sources: [],
      events: [],
      labels,
    });

    const gatesOf = (id: string) =>
      graph.blocks.find((block) => block.kind === "tasks")?.points.find((point) => point.entityId === id)?.gates;
    expect(gatesOf("agent-on")?.find((gate) => gate.kind === "calendarWrite")).toEqual({
      kind: "calendarWrite",
      on: true,
      toggleable: true,
    });
    expect(gatesOf("agent-off")?.find((gate) => gate.kind === "calendarWrite")).toEqual({
      kind: "calendarWrite",
      on: false,
      toggleable: true,
    });
    expect(gatesOf("agent-on")?.find((gate) => gate.kind === "calendar")).toEqual({
      kind: "calendar",
      on: true,
      toggleable: true,
    });
    expect(gatesOf("intel-1")?.some((gate) => gate.kind === "calendarWrite")).toBe(false);
    expect(gatesOf("lb-1")?.some((gate) => gate.kind === "calendarWrite")).toBe(false);
  });

  it("places assistant in layer 2 with no calendar status icon; L4 pages hang off the workset layer port", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: false }],
      tasks: [],
      items: [],
      sources: [],
      events: [],
      labels,
      assistantDefaultWorksetId: "ws-1",
    });

    const assistant = graph.blocks.find((block) => block.kind === "assistant");
    const notify = graph.blocks.find((block) => block.kind === "notify")?.points[0];
    const external = graph.blocks.find((block) => block.kind === "external")?.points[0];
    expect(graph.blocks.find((block) => block.kind === "intel")?.column).toBe(3);
    expect(graph.blocks.find((block) => block.kind === "timeline")?.column).toBe(3);
    expect(graph.blocks.find((block) => block.kind === "notify")?.column).toBe(3);
    expect(graph.blocks.find((block) => block.kind === "external")?.column).toBe(3);
    expect(notify?.href).toBe("/notify?tab=notify");
    expect(notify?.label).toBe("本機通知");
    expect(external?.href).toBe("/notify?tab=types");
    expect(external?.label).toBe("動作");
    expect(assistant?.column).toBe(1);
    expect(assistant?.points.map((point) => point.id)).toEqual([PIPELINE_PAGE.assistant]);
    expect(assistant?.points[0]?.gates ?? []).toEqual([]);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === worksetPointId("ws-1") &&
          (edge.targetPointId === "page:mcp" ||
            edge.targetPointId === "page:a2a" ||
            edge.targetPointId === "page:notify" ||
            edge.targetPointId === "page:timeline" ||
            edge.targetPointId === "page:intel" ||
            edge.targetPointId === "page:external"),
      ),
    ).toBe(false);
    expect(graph.edges).toEqual(
      expect.arrayContaining(
        ["page:timeline", "page:intel", "page:notify", "page:external"].map((targetPointId) =>
          expect.objectContaining({
            sourcePointId: PIPELINE_LAYER_PORT.worksets,
            sourceBlockId: PIPELINE_BLOCK.worksets,
            targetPointId,
            legend: true,
          }),
        ),
      ),
    );
    expect(graph.blocks.find((block) => block.kind === "worksets")?.points[0]?.gates).toEqual([
      { kind: "notify", on: true, toggleable: true },
      { kind: "external", on: false, toggleable: true },
    ]);
    expect(
      graph.blocks
        .find((block) => block.kind === "worksets")
        ?.points[0]?.gates?.some((gate) => gate.kind === "calendar" || gate.kind === "intel"),
    ).toBe(false);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges.some((edge) => edge.targetPointId === PIPELINE_PAGE.assistant)).toBe(false);
    expect(graph.edges.some((edge) => edge.targetPointId === "page:webhook")).toBe(false);
    expect(graph.edges.some((edge) => edge.targetPointId === "page:deeplink")).toBe(false);
    expect(graph.blocks.some((block) => block.id === "block-calendar")).toBe(false);
    expect(graph.blocks.some((block) => block.id === "block-mcp")).toBe(false);
    expect(graph.blocks.some((block) => block.id === "block-a2a")).toBe(false);
  });

  it("keeps L4 legend edges when notify and external gates are off", () => {
    const off = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: false, externalEnabled: false }],
      tasks: [],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const on = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const legendOf = (graph: typeof off) =>
      graph.edges
        .filter((edge) => edge.legend)
        .map((edge) => edge.id)
        .sort();
    expect(legendOf(off)).toEqual(legendOf(on));
    expect(legendOf(off)).toEqual(
      [
        `${PIPELINE_LAYER_PORT.worksets}->${PIPELINE_PAGE.external}`,
        `${PIPELINE_LAYER_PORT.worksets}->${PIPELINE_PAGE.intel}`,
        `${PIPELINE_LAYER_PORT.worksets}->${PIPELINE_PAGE.notify}`,
        `${PIPELINE_LAYER_PORT.worksets}->${PIPELINE_PAGE.timeline}`,
      ].sort(),
    );
    expect(off.blocks.find((block) => block.kind === "worksets")?.points[0]?.gates).toEqual([
      { kind: "notify", on: false, toggleable: true },
      { kind: "external", on: false, toggleable: true },
    ]);
  });

  it("wires a task with no worksetId onto 一般, not an unassigned node", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [
        { id: "__general__", name: "一般", notifyEnabled: true, externalEnabled: true },
        { id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true },
      ],
      tasks: [{ id: "loose", name: "Loose", worksetId: null, outputAnalysisEvents: false, notifyPref: "off" }],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: taskPointId("loose"),
        targetPointId: worksetPointId("__general__"),
      }),
    );
    expect(graph.blocks.find((block) => block.kind === "worksets")?.points.map((point) => point.id)).not.toContain(
      "workset:unassigned",
    );
  });

  it("keeps a four-column layout: 第一層…第四層", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "__general__", name: "一般", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [{ id: "item-123", title: "123", worksetId: "__general__" }],
      sources: [],
      events: [],
      labels,
    });

    const byKind = Object.fromEntries(graph.blocks.map((block) => [block.kind, block]));
    expect(byKind.sources?.column).toBe(0);
    expect(byKind.items?.column).toBe(0);
    expect(byKind.assistant?.column).toBe(1);
    expect(byKind.tasks?.column).toBe(1);
    expect(byKind.tasks?.points).toEqual([]);
    expect(byKind.itemEvents).toBeUndefined();
    expect(byKind.calendar).toBeUndefined();
    expect(byKind.worksets?.column).toBe(2);
    expect(byKind.intel?.column).toBe(3);
    expect(byKind.timeline?.column).toBe(3);
    expect(byKind.notify?.column).toBe(3);
    expect(byKind.external?.column).toBe(3);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === itemPointId("item-123") && edge.targetPointId === worksetPointId("__general__"),
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) => edge.sourcePointId === "page:calendar" || edge.targetPointId === "page:calendar",
      ),
    ).toBe(false);
  });

  it("scopes the graph to one workset while keeping feeding sources", () => {
    const input: PipelineGraphInput = {
      worksets: [
        { id: "__general__", name: "一般", notifyEnabled: true, externalEnabled: true },
        { id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true },
      ],
      tasks: [
        {
          id: "t1",
          name: "Scan",
          worksetId: "ws-1",
          outputAnalysisEvents: true,
          notifyPref: "off",
          channelIds: ["telegram:42"],
        },
        { id: "t2", name: "Inbox", worksetId: "__general__", outputAnalysisEvents: true, notifyPref: "off" },
      ],
      items: [
        { id: "item-ops", title: "Ops item", worksetId: "ws-1" },
        { id: "item-gen", title: "General item", worksetId: "__general__" },
      ],
      sources: [
        { id: "src-1", name: "News" },
        { id: "src-2", name: "Other" },
      ],
      channels: [{ channelId: "telegram:42", sourceId: "src-1" }],
      events: [
        { id: "ev-ops", title: "Ops cal", worksetId: "ws-1" },
        { id: "ev-gen", title: "General cal", worksetId: "__general__" },
      ],
      labels,
    };
    const graph = buildWorksetPipelineGraph(scopePipelineInputToWorkset(input, "ws-1"));
    const pointIds = graph.blocks.flatMap((block) => block.points.map((point) => point.id));
    expect(pointIds).toContain(taskPointId("t1"));
    expect(pointIds).toContain(itemPointId("item-ops"));
    expect(pointIds).toContain(worksetPointId("ws-1"));
    expect(pointIds).toContain(sourcePointId("src-1"));
    expect(pointIds).toContain(PIPELINE_PAGE.assistant);
    expect(pointIds).toContain("page:intel");
    expect(pointIds).not.toContain(taskPointId("t2"));
    expect(pointIds).not.toContain(itemPointId("item-gen"));
    expect(pointIds).not.toContain(worksetPointId("__general__"));
    expect(pointIds).not.toContain(sourcePointId("src-2"));
    expect(pointIds).not.toContain("calendar:ev-ops");
    expect(
      graph.edges.every(
        (edge) =>
          (pointIds.includes(edge.sourcePointId) || edge.sourcePointId === PIPELINE_LAYER_PORT.worksets) &&
          pointIds.includes(edge.targetPointId),
      ),
    ).toBe(true);
  });

  it("scopes the household graph to several checked worksets", () => {
    const input = {
      worksets: [
        { id: "__general__", name: "一般", notifyEnabled: true, externalEnabled: true },
        { id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true },
        { id: "ws-2", name: "Labs", notifyEnabled: true, externalEnabled: true },
      ],
      tasks: [
        { id: "t1", name: "Scan", worksetId: "ws-1", outputAnalysisEvents: true, notifyPref: "off" },
        { id: "t2", name: "Inbox", worksetId: "__general__", outputAnalysisEvents: true, notifyPref: "off" },
        { id: "t3", name: "Labs", worksetId: "ws-2", outputAnalysisEvents: true, notifyPref: "off" },
      ],
      items: [],
      sources: [],
      events: [],
      labels,
    };
    const graph = buildWorksetPipelineGraph(scopePipelineInputToWorkset(input, ["ws-1", "__general__"]));
    const pointIds = graph.blocks.flatMap((block) => block.points.map((point) => point.id));
    expect(pointIds).toContain(worksetPointId("ws-1"));
    expect(pointIds).toContain(worksetPointId("__general__"));
    expect(pointIds).toContain(taskPointId("t1"));
    expect(pointIds).toContain(taskPointId("t2"));
    expect(pointIds).not.toContain(worksetPointId("ws-2"));
    expect(pointIds).not.toContain(taskPointId("t3"));
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: worksetPointId("__general__"),
      }),
    );
    expect(
      graph.edges.filter((edge) => edge.sourcePointId === PIPELINE_PAGE.assistant),
    ).toHaveLength(1);
  });

  it("collapses overflow points inside a block until expanded", () => {
    const tasks = Array.from({ length: PIPELINE_VISIBLE_POINTS + 3 }, (_, index) => ({
      id: `t${index + 1}`,
      name: `Task ${index + 1}`,
      worksetId: "ws-1",
      outputAnalysisEvents: false,
      notifyPref: "off" as const,
    }));
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks,
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const collapsed = collapsePipelineGraph(graph, new Set());
    const taskBlock = collapsed.graph.blocks.find((block) => block.kind === "tasks");
    expect(taskBlock?.points).toHaveLength(PIPELINE_VISIBLE_POINTS);
    expect(collapsed.overflowByBlockId["block-tasks"]).toBe(3);
    expect(taskBlock?.points.map((point) => point.entityId)).toEqual(
      tasks.slice(0, PIPELINE_VISIBLE_POINTS).map((task) => task.id),
    );
    expect(collapsed.graph.edges.some((edge) => edge.sourcePointId === taskPointId("t11"))).toBe(false);

    const expanded = collapsePipelineGraph(graph, new Set(["block-tasks"]));
    expect(expanded.graph.blocks.find((block) => block.kind === "tasks")?.points).toHaveLength(tasks.length);
    expect(expanded.overflowByBlockId["block-tasks"]).toBe(3);
  });

  it("wires assistant to the voice default workset only", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [
        { id: "__general__", name: "一般", notifyEnabled: true, externalEnabled: true },
        { id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true },
      ],
      tasks: [{ id: "t1", name: "Scan", worksetId: "ws-1", outputAnalysisEvents: false, notifyPref: "off" }],
      items: [{ id: "item-1", title: "Milk", worksetId: "__general__" }],
      sources: [],
      events: [],
      labels,
      assistantDefaultWorksetId: "ws-1",
    });
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourceBlockId: PIPELINE_BLOCK.assistant,
        sourcePointId: PIPELINE_PAGE.assistant,
        targetBlockId: PIPELINE_BLOCK.worksets,
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges.filter((edge) => edge.sourcePointId === PIPELINE_PAGE.assistant)).toHaveLength(1);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === PIPELINE_PAGE.assistant && edge.targetPointId === worksetPointId("__general__"),
      ),
    ).toBe(false);
  });

  it("places ports on the point row and wires item→workset without faking 日程页", () => {
    expect(pipelinePointHandleTop(0)).toBe(46);
    expect(pipelinePointHandleTop(1)).toBe(70);

    const linked = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [{ id: "item-1", title: "123", worksetId: "ws-1" }],
      sources: [],
      events: [{ id: "ev-exp", title: "Expires", worksetId: "ws-1", itemId: "item-1", kind: "expires" }],
      labels,
    });
    expect(linked.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: itemPointId("item-1"),
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(
      linked.blocks
        .find((block) => block.kind === "items")
        ?.points.find((point) => point.entityId === "item-1")?.gates,
    ).toEqual([{ kind: "calendar", on: true, toggleable: false }]);
    expect(
      linked.edges.some(
        (edge) => edge.sourcePointId === itemPointId("item-1") && edge.targetPointId === "page:calendar",
      ),
    ).toBe(false);

    const unlinked = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [{ id: "item-1", title: "123", worksetId: "ws-1" }],
      sources: [],
      events: [],
      labels,
    });
    expect(
      unlinked.blocks
        .find((block) => block.kind === "items")
        ?.points.find((point) => point.entityId === "item-1")?.gates,
    ).toEqual([{ kind: "calendar", on: false, toggleable: false }]);
  });

  it("places items in layer 1 and still wires item→workset without source→item", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [
        {
          id: "t1",
          name: "Scan",
          worksetId: "ws-1",
          outputAnalysisEvents: false,
          notifyPref: "off",
          channelIds: ["telegram:42"],
        },
      ],
      items: [{ id: "item-1", title: "Milk", worksetId: "ws-1" }],
      sources: [{ id: "src-1", name: "News" }],
      channels: [{ channelId: "telegram:42", sourceId: "src-1" }],
      events: [],
      labels,
    });
    expect(graph.blocks.find((block) => block.kind === "items")?.column).toBe(0);
    expect(graph.blocks.find((block) => block.kind === "sources")?.column).toBe(0);
    expect(graph.blocks.find((block) => block.kind === "tasks")?.column).toBe(1);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: itemPointId("item-1"),
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: sourcePointId("src-1"),
        targetPointId: taskPointId("t1"),
      }),
    );
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId.startsWith("source:") &&
          (edge.targetPointId.startsWith("item:") || edge.targetPointId === PIPELINE_PAGE.assistant),
      ),
    ).toBe(false);
  });
});
