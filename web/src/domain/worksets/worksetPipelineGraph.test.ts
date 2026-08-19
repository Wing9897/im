import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PIPELINE_BLOCK,
  PIPELINE_BLOCK_COLUMN,
  PIPELINE_COL_GAP_X,
  PIPELINE_COL_X,
  PIPELINE_EDGE_PALETTE,
  PIPELINE_EDGE_TYPE,
  PIPELINE_PAGE,
  PIPELINE_LAYER_PORT,
  PIPELINE_VISIBLE_POINTS,
  PIPELINE_ZONE_WIDTH,
  buildWorksetPipelineGraph,
  collapsePipelineGraph,
  itemPointId,
  layoutPipelineFlow,
  pipelineBlockHeight,
  pipelineEdgeStroke,
  pipelinePointHandleTop,
  scopePipelineInputToWorkset,
  sourcePointId,
  taskIntelEnabled,
  taskPointId,
  worksetPointId,
  type PipelineFlowNode,
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
  notify: "通知",
  external: "外部接口",
};

function blockPoints(nodes: PipelineFlowNode[], id: string) {
  const node = nodes.find((row) => row.id === id);
  return node?.type === "worksetBlock" ? node.data.block.points : [];
}

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
    expect(graph.blocks.find((block) => block.kind === "intel")?.column).toBe(3);
    expect(graph.blocks.find((block) => block.kind === "timeline")?.column).toBe(3);
    expect(graph.blocks.find((block) => block.kind === "notify")?.column).toBe(3);
    expect(graph.blocks.find((block) => block.kind === "external")?.column).toBe(3);
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
    expect(legendOf(off)).toEqual([
      `${PIPELINE_LAYER_PORT.worksets}->${PIPELINE_PAGE.external}`,
      `${PIPELINE_LAYER_PORT.worksets}->${PIPELINE_PAGE.intel}`,
      `${PIPELINE_LAYER_PORT.worksets}->${PIPELINE_PAGE.notify}`,
      `${PIPELINE_LAYER_PORT.worksets}->${PIPELINE_PAGE.timeline}`,
    ].sort());
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

  it("lays out fixed columns with nodes that cannot be dragged", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [{ id: "t1", name: "Scan", worksetId: "ws-1", outputAnalysisEvents: true }],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const flow = layoutPipelineFlow(graph);
    const blockNodes = flow.nodes.filter((node) => node.type === "worksetBlock");
    expect(flow.nodes.every((node) => node.draggable === false)).toBe(true);
    expect(
      blockNodes.every((node) => {
        const output = node.data.block.column === 3;
        if (output || node.data.block.points.length === 0) return node.connectable === false;
        return node.connectable === true;
      }),
    ).toBe(true);
    expect(flow.nodes.filter((node) => node.type === "layerZone").every((node) => node.connectable === false)).toBe(
      true,
    );
    expect(flow.nodes.filter((node) => node.type === "layerZone")).toHaveLength(4);
    expect(blockNodes.every((node) => node.style.pointerEvents === "all")).toBe(true);
    expect(blockNodes.every((node) => node.zIndex === 4)).toBe(true);
    expect(flow.nodes.filter((node) => node.type === "layerZone").every((node) => node.zIndex === 2)).toBe(
      true,
    );
    expect(blockNodes.every((node) => node.className.includes("nopan"))).toBe(true);
    expect(blockNodes.some((node) => node.id === "block-worksets")).toBe(true);
    expect(blockNodes.some((node) => node.id === "block-tasks")).toBe(true);
    expect(blockNodes.some((node) => node.id === "block-intel")).toBe(true);
    expect(new Set(blockNodes.map((node) => node.position.x)).size).toBeLessThanOrEqual(4);
    expect(flow.edges.find((row) => row.id === `${worksetPointId("ws-1")}->page:timeline`)).toBeUndefined();
    expect(flow.edges.find((row) => row.id === `${PIPELINE_LAYER_PORT.worksets}->page:timeline`)).toBeTruthy();
    expect(flow.edges.some((row) => row.id === `${taskPointId("t1")}->page:intel`)).toBe(false);
    const ownership = flow.edges.find((row) => row.id === `${taskPointId("t1")}->${worksetPointId("ws-1")}`);
    expect(ownership?.sourceHandle).toBe("task:t1__out");
    expect(ownership?.targetHandle).toBe("workset:ws-1__in");
    expect(ownership?.type).toBe(PIPELINE_EDGE_TYPE);
  });

  it("marks legal connect targets and mutes the rest while a point is selected", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [{ id: "t1", name: "Scan", worksetId: "ws-1", outputAnalysisEvents: true }],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const legal = new Set([worksetPointId("ws-1"), sourcePointId("src-1")]);
    const flow = layoutPipelineFlow(graph, taskPointId("t1"), legal);
    const tasks = blockPoints(flow.nodes, "block-tasks");
    const worksets = blockPoints(flow.nodes, "block-worksets");
    expect(flow.nodes.some((node) => node.id === "block-intel")).toBe(true);
    expect(flow.nodes.some((node) => node.id === "block-external")).toBe(true);
    expect(tasks.find((point) => point.id === taskPointId("t1"))?.muted).toBe(false);
    expect(worksets.find((point) => point.id === worksetPointId("ws-1"))?.legalTarget).toBe(true);
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
    expect(byKind.assistant?.column).toBe(1);
    expect(byKind.items?.column).toBe(0);
    expect(byKind.tasks?.column).toBe(1);
    expect(byKind.tasks?.points).toEqual([]);
    expect(byKind.itemEvents).toBeUndefined();
    expect(byKind.calendar).toBeUndefined();
    expect(byKind.worksets?.column).toBe(2);
    expect(byKind.intel?.column).toBe(3);
    expect(byKind.timeline?.column).toBe(3);
    expect(byKind.notify?.column).toBe(3);
    expect(byKind.external?.column).toBe(3);

    const flow = layoutPipelineFlow(graph);
    const blockX = (id: string) => flow.nodes.find((node) => node.id === id)?.position.x;
    expect(blockX(PIPELINE_BLOCK.sources)).toBe(PIPELINE_COL_X[0]);
    expect(blockX(PIPELINE_BLOCK.assistant)).toBe(PIPELINE_COL_X[1]);
    expect(blockX(PIPELINE_BLOCK.tasks)).toBe(PIPELINE_COL_X[1]);
    expect(blockX(PIPELINE_BLOCK.items)).toBe(PIPELINE_COL_X[0]);
    expect(blockX(PIPELINE_BLOCK.items)).toBe(blockX(PIPELINE_BLOCK.sources));
    expect(blockX(PIPELINE_BLOCK.worksets)).toBe(PIPELINE_COL_X[2]);
    expect(blockX("block-intel")).toBe(PIPELINE_COL_X[3]);
    expect(PIPELINE_COL_X[1] - PIPELINE_COL_X[0]).toBe(PIPELINE_ZONE_WIDTH + PIPELINE_COL_GAP_X);
    expect(PIPELINE_COL_GAP_X).toBe(64);
    expect(PIPELINE_COL_X).toHaveLength(4);
    expect(flow.nodes.filter((node) => node.type === "layerZone")).toHaveLength(4);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === itemPointId("item-123") && edge.targetPointId === worksetPointId("__general__"),
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === itemPointId("item-123") && edge.targetPointId === "page:calendar",
      ),
    ).toBe(false);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: worksetPointId("__general__"),
      }),
    );
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === PIPELINE_PAGE.assistant && edge.targetPointId === itemPointId("item-123"),
      ),
    ).toBe(false);
    expect(
      graph.edges.some(
        (edge) => edge.sourcePointId === "page:calendar" || edge.targetPointId === "page:calendar",
      ),
    ).toBe(false);
  });

  it("does not place item-linked events as a middle column", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [{ id: "item-1", title: "Milk", worksetId: "ws-1" }],
      sources: [],
      events: [
        { id: "ev-exp", title: "Milk expires", worksetId: "ws-1", itemId: "item-1", kind: "expires" },
        { id: "ev-cal", title: "Standup", worksetId: "ws-1" },
      ],
      labels,
      assistantDefaultWorksetId: "ws-1",
    });

    const calendar = graph.blocks.find((block) => block.id === "block-calendar");
    const tasks = graph.blocks.find((block) => block.kind === "tasks");
    const assistant = graph.blocks.find((block) => block.kind === "assistant");
    expect(graph.blocks.find((block) => block.kind === "itemEvents")).toBeUndefined();
    expect(calendar).toBeUndefined();
    expect(assistant?.column).toBe(1);
    expect(tasks?.column).toBe(1);
    expect(graph.blocks.find((block) => block.kind === "items")?.column).toBe(0);
    expect(graph.blocks.find((block) => block.kind === "worksets")?.column).toBe(2);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: itemPointId("item-1"),
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === PIPELINE_PAGE.assistant && edge.targetPointId === itemPointId("item-1"),
      ),
    ).toBe(false);
    expect(graph.edges.some((edge) => edge.sourcePointId.startsWith("itemEvent:"))).toBe(false);
    expect(graph.edges.some((edge) => edge.targetPointId.startsWith("itemEvent:"))).toBe(false);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === worksetPointId("ws-1") &&
          (edge.targetPointId.startsWith("itemEvent:") ||
            edge.targetPointId.startsWith("calendar:") ||
            edge.targetPointId === "page:calendar"),
      ),
    ).toBe(false);
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
    expect(pointIds).toContain("page:timeline");
    expect(pointIds).not.toContain("page:calendar");
    expect(pointIds).not.toContain(taskPointId("t2"));
    expect(pointIds).not.toContain(itemPointId("item-gen"));
    expect(pointIds).not.toContain(worksetPointId("__general__"));
    expect(pointIds).not.toContain(sourcePointId("src-2"));
    expect(pointIds).not.toContain("calendar:ev-ops");
    expect(pointIds).not.toContain("calendar:ev-gen");
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === PIPELINE_PAGE.assistant && edge.targetPointId === worksetPointId("ws-1"),
      ),
    ).toBe(false);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === PIPELINE_PAGE.assistant && edge.targetPointId === worksetPointId("__general__"),
      ),
    ).toBe(false);
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
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === PIPELINE_PAGE.assistant && edge.targetPointId === worksetPointId("ws-1"),
      ),
    ).toBe(false);
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
    expect(
      collapsed.graph.edges.some((edge) => edge.sourcePointId === taskPointId("t11")),
    ).toBe(false);

    const expanded = collapsePipelineGraph(graph, new Set(["block-tasks"]));
    expect(expanded.graph.blocks.find((block) => block.kind === "tasks")?.points).toHaveLength(tasks.length);
    expect(expanded.overflowByBlockId["block-tasks"]).toBe(3);
  });

  it("does not fan worksets to 時間規劃／情報／通知／MCP／A2A page nodes", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "__general__", name: "一般", notifyEnabled: true, externalEnabled: true }],
      tasks: [
        {
          id: "t1",
          name: "Scan",
          worksetId: "__general__",
          outputAnalysisEvents: true,
          includeInTimeline: true,
        },
      ],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    for (const targetId of ["page:intel", "page:timeline", "page:notify", "page:mcp", "page:a2a"]) {
      expect(
        graph.edges.some(
          (edge) =>
            edge.sourcePointId === worksetPointId("__general__") && edge.targetPointId === targetId,
        ),
      ).toBe(false);
    }
    expect(
      graph.edges.some(
        (edge) => edge.sourcePointId === taskPointId("t1") && edge.targetPointId === "page:intel",
      ),
    ).toBe(false);
    const taskGates = graph.blocks
      .find((block) => block.kind === "tasks")
      ?.points.find((point) => point.entityId === "t1")?.gates;
    expect(taskGates?.find((gate) => gate.kind === "calendar")).toEqual({
      kind: "calendar",
      on: true,
      toggleable: true,
    });
    expect(taskGates?.find((gate) => gate.kind === "intel")?.on).toBe(true);
    expect(
      graph.edges.filter((edge) => edge.sourcePointId === PIPELINE_LAYER_PORT.worksets && edge.legend),
    ).toHaveLength(4);
    expect(graph.edges.some((edge) => edge.targetPointId === "page:mcp")).toBe(false);
    expect(graph.edges.some((edge) => edge.targetPointId === "page:a2a")).toBe(false);
  });

  it("keeps an empty 任务 block and puts 助手 in 第二層 with tasks", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [],
      sources: [],
      events: [],
      labels,
      assistantDefaultWorksetId: "ws-1",
    });
    const tasks = graph.blocks.find((block) => block.kind === "tasks");
    const assistant = graph.blocks.find((block) => block.kind === "assistant");
    const sources = graph.blocks.find((block) => block.kind === "sources");
    expect(graph.blocks.find((block) => block.kind === "itemEvents")).toBeUndefined();
    expect(graph.blocks.find((block) => block.id === "block-calendar")).toBeUndefined();
    expect(tasks?.points).toEqual([]);
    expect(sources?.points).toEqual([]);
    expect(assistant?.column).toBe(1);
    expect(assistant?.points).toEqual([
      expect.objectContaining({ id: PIPELINE_PAGE.assistant, kind: "page", label: "助手" }),
    ]);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(pipelineBlockHeight(0)).toBeLessThan(pipelineBlockHeight(1));
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
    const assistant = graph.blocks.find((block) => block.kind === "assistant");
    const items = graph.blocks.find((block) => block.kind === "items");
    const tasks = graph.blocks.find((block) => block.kind === "tasks");
    expect(assistant?.column).toBe(1);
    expect(items?.column).toBe(0);
    expect(tasks?.column).toBe(1);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourceBlockId: PIPELINE_BLOCK.items,
        sourcePointId: itemPointId("item-1"),
        targetBlockId: PIPELINE_BLOCK.worksets,
        targetPointId: worksetPointId("__general__"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourceBlockId: PIPELINE_BLOCK.tasks,
        sourcePointId: taskPointId("t1"),
        targetBlockId: PIPELINE_BLOCK.worksets,
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourceBlockId: PIPELINE_BLOCK.assistant,
        sourcePointId: PIPELINE_PAGE.assistant,
        targetBlockId: PIPELINE_BLOCK.worksets,
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(
      graph.edges.filter((edge) => edge.sourcePointId === PIPELINE_PAGE.assistant),
    ).toHaveLength(1);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === PIPELINE_PAGE.assistant && edge.targetPointId === worksetPointId("__general__"),
      ),
    ).toBe(false);
  });

  it("gives each column a distinct zone class", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const flow = layoutPipelineFlow(graph);
    const zoneClasses = flow.nodes
      .filter((node) => node.type === "layerZone")
      .map((node) => node.className);
    expect(zoneClasses).toEqual([
      "im-ws-graph-zone-node is-layer1 nopan nodrag",
      "im-ws-graph-zone-node is-layer2 nopan nodrag",
      "im-ws-graph-zone-node is-layer3 nopan nodrag",
      "im-ws-graph-zone-node is-layer4 nopan nodrag",
    ]);
    expect(new Set(zoneClasses).size).toBe(4);
    const zoneHeights = flow.nodes
      .filter((node) => node.type === "layerZone")
      .map((node) => Number(node.style.height));
    expect(new Set(zoneHeights).size).toBeGreaterThan(1);
  });

  it("uses a distinct color token per zone band", () => {
    const css = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../../css/workset-pipeline-graph.css"),
      "utf8",
    );
    const tokenOf = (cls: string) => {
      const match = css.match(new RegExp(`\\.im-ws-graph-zone\\.${cls}\\s*\\{([^}]+)\\}`));
      return match?.[1].match(/var\(--[\w-]+\)/)?.[0] ?? "";
    };
    const tokens = ["is-layer1", "is-layer2", "is-layer3", "is-layer4"].map(tokenOf);
    expect(tokens).toEqual(["var(--info)", "var(--warning)", "var(--success)", "var(--accent)"]);
    expect(new Set(tokens).size).toBe(4);
    expect(css).toContain("height: 30px;");
    expect(css).toContain("height: 24px;");
    expect(css).toContain("--im-ws-graph-zone-width: 188px;");
    expect(css).toContain("--im-ws-graph-col-gap-x: 64px;");
    expect(css).toContain("z-index: 2 !important");
    expect(css).toMatch(
      /\.react-flow__viewport\s+\.react-flow__edges\s*\{[^}]*z-index:\s*0/s,
    );
    expect(css).toMatch(
      /\.react-flow__node\.im-ws-graph-zone-node\s*\{[^}]*z-index:\s*2\s*!important/s,
    );
    expect(css).toContain("var(--surface-panel)");
    expect(css).toContain(".react-flow__background");
    expect(css).toContain(".react-flow__pane");
    expect(css).toContain(".im-ws-graph-filter-menu");
    expect(css).toContain(".im-ws-graph-point-gate");
    expect(css).toContain(".im-ws-graph-edge.is-dimmed");
    expect(css).toContain(".im-ws-graph-edge.is-focused");
    expect(css).toContain(".react-flow__node.is-unfocused");
    expect(css).not.toContain("var(--surface-base) 88%, #000");
    expect(css).toContain("is-layer4");
    expect(css).not.toContain("is-layer5");

    const panel = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../../pages/worksets/WorksetPipelineGraphPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("type: PIPELINE_EDGE_TYPE");
    expect(panel).toContain("WorksetPipelineConnectionLine");
    expect(panel).toContain("im-surface-panel");
    expect(panel).not.toContain('type: "default"');
    expect(panel).not.toContain("ConnectionLineType.SmoothStep");
    expect(panel).not.toContain("ConnectionLineType.Bezier");
  });

  it("places ports on the point row and wires item→workset without faking 日程页", () => {
    expect(pipelinePointHandleTop(0)).toBe(46);
    expect(pipelinePointHandleTop(1)).toBe(70);

    const linked = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [{ id: "item-1", title: "123", worksetId: "ws-1" }],
      sources: [],
      events: [
        { id: "ev-exp", title: "Expires", worksetId: "ws-1", itemId: "item-1", kind: "expires" },
      ],
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
        (edge) =>
          edge.sourcePointId === itemPointId("item-1") &&
          edge.targetPointId === "page:calendar",
      ),
    ).toBe(false);
    expect(linked.edges.some((edge) => edge.sourcePointId.startsWith("itemEvent:"))).toBe(false);

    const unlinked = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [{ id: "item-1", title: "123", worksetId: "ws-1" }],
      sources: [],
      events: [],
      labels,
    });
    expect(unlinked.blocks.find((block) => block.kind === "itemEvents")).toBeUndefined();
    expect(unlinked.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: itemPointId("item-1"),
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(
      unlinked.blocks
        .find((block) => block.kind === "items")
        ?.points.find((point) => point.entityId === "item-1")?.gates,
    ).toEqual([{ kind: "calendar", on: false, toggleable: false }]);
    const emptyTasks = layoutPipelineFlow(unlinked).nodes.find(
      (node) => node.id === PIPELINE_BLOCK.tasks,
    );
    expect(emptyTasks?.type === "worksetBlock" && emptyTasks.connectable).toBe(false);
  });

  it("uses adjacent-layer smoothstep wires", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [{ id: "t1", name: "Scan", worksetId: "ws-1", outputAnalysisEvents: true, includeInTimeline: true }],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const flow = layoutPipelineFlow(graph);
    expect(flow.nodes.some((node) => node.id === PIPELINE_BLOCK.worksets)).toBe(true);
    expect(flow.nodes.some((node) => node.id === "block-intel")).toBe(true);

    for (const id of [
      `${taskPointId("t1")}->page:intel`,
      `${taskPointId("t1")}->page:timeline`,
      `${taskPointId("t1")}->page:notify`,
      `${worksetPointId("ws-1")}->page:timeline`,
      `${worksetPointId("ws-1")}->page:notify`,
      `${worksetPointId("ws-1")}->page:mcp`,
      `${worksetPointId("ws-1")}->page:a2a`,
    ]) {
      expect(flow.edges.find((row) => row.id === id)).toBeUndefined();
    }
    expect(flow.edges.find((row) => row.id === `${PIPELINE_LAYER_PORT.worksets}->page:timeline`)).toBeTruthy();
    const adjacent = flow.edges.find((row) => row.id === `${taskPointId("t1")}->${worksetPointId("ws-1")}`);
    expect(adjacent?.type).toBe("smoothstep");
    expect(flow.edges.every((edge) => edge.type === "smoothstep")).toBe(true);
    expect(flow.edges.some((edge) => (edge.type as string) === "default")).toBe(false);
  });

  it("hashes a stable distinct stroke from each edge id", () => {
    expect(PIPELINE_EDGE_PALETTE).toHaveLength(12);
    expect(new Set(PIPELINE_EDGE_PALETTE).size).toBe(12);
    const ids = [
      `${sourcePointId("src-1")}->${taskPointId("t1")}`,
      `${itemPointId("item-1")}->${worksetPointId("ws-1")}`,
      `${taskPointId("t1")}->${worksetPointId("ws-1")}`,
      `${PIPELINE_PAGE.assistant}->${worksetPointId("__general__")}`,
    ];
    const colors = ids.map((id) => pipelineEdgeStroke(id));
    expect(colors.every((color) => (PIPELINE_EDGE_PALETTE as readonly string[]).includes(color))).toBe(true);
    expect(pipelineEdgeStroke(ids[0])).toBe(pipelineEdgeStroke(ids[0]));
    expect(new Set(colors).size).toBeGreaterThan(1);
    expect(PIPELINE_BLOCK_COLUMN.items).toBe(PIPELINE_BLOCK_COLUMN.sources);
    expect(PIPELINE_BLOCK_COLUMN.tasks).toBe(PIPELINE_BLOCK_COLUMN.assistant);
    expect(PIPELINE_BLOCK_COLUMN.worksets).toBe(2);
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

    const flow = layoutPipelineFlow(graph);
    expect(flow.edges.every((edge) => edge.style.stroke === pipelineEdgeStroke(edge.id))).toBe(true);
    expect(flow.edges.every((edge) => !edge.className.includes("is-dimmed"))).toBe(true);
    const itemWire = flow.edges.find((row) => row.id === `${itemPointId("item-1")}->${worksetPointId("ws-1")}`);
    expect(itemWire?.type).toBe("smoothstep");
  });

  it("dims other edges when a point or edge is focused", () => {
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
      assistantDefaultWorksetId: "ws-1",
    });
    const taskId = taskPointId("t1");
    const taskWorkset = `${taskId}->${worksetPointId("ws-1")}`;
    const sourceTask = `${sourcePointId("src-1")}->${taskId}`;
    const itemWorkset = `${itemPointId("item-1")}->${worksetPointId("ws-1")}`;
    const assistantWorkset = `${PIPELINE_PAGE.assistant}->${worksetPointId("ws-1")}`;

    const pointFocus = layoutPipelineFlow(graph, taskId, new Set([worksetPointId("ws-1")]));
    expect(pointFocus.edges.find((edge) => edge.id === taskWorkset)?.className).toContain("is-focused");
    expect(pointFocus.edges.find((edge) => edge.id === sourceTask)?.className).toContain("is-focused");
    expect(pointFocus.edges.find((edge) => edge.id === itemWorkset)?.className).toContain("is-dimmed");
    expect(pointFocus.edges.find((edge) => edge.id === assistantWorkset)?.className).toContain("is-dimmed");
    expect(pointFocus.nodes.find((node) => node.id === PIPELINE_BLOCK.tasks)?.className).not.toContain("is-unfocused");
    expect(pointFocus.nodes.find((node) => node.id === PIPELINE_BLOCK.items)?.className).toContain("is-unfocused");

    const edgeFocus = layoutPipelineFlow(graph, null, null, { focusedEdgeId: itemWorkset });
    expect(edgeFocus.edges.find((edge) => edge.id === itemWorkset)?.className).toContain("is-focused");
    expect(edgeFocus.edges.find((edge) => edge.id === taskWorkset)?.className).toContain("is-dimmed");
    expect(edgeFocus.nodes.find((node) => node.id === PIPELINE_BLOCK.items)?.className).not.toContain("is-unfocused");
    expect(edgeFocus.nodes.find((node) => node.id === PIPELINE_BLOCK.tasks)?.className).toContain("is-unfocused");
  });
});
