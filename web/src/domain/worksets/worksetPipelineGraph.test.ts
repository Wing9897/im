import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PIPELINE_BLOCK,
  PIPELINE_BLOCK_WIDTH,
  PIPELINE_COL_GAP_X,
  PIPELINE_COL_X,
  PIPELINE_EDGE_TYPE,
  PIPELINE_PAGE,
  PIPELINE_VISIBLE_POINTS,
  PIPELINE_ZONE_WIDTH,
  buildWorksetPipelineGraph,
  collapsePipelineGraph,
  itemPointId,
  layoutPipelineFlow,
  pipelineBlockHeight,
  pipelinePathHitsAabb,
  pipelinePointHandleTop,
  pipelineSkipLayerWaypoints,
  pipelineWorksetDetour,
  pipelineZoneX,
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
  calendar: "我的日程",
  calendarPage: "日程頁",
  intel: "情報頁",
  timeline: "時間規劃",
  notify: "通知",
  mcp: "MCP",
  a2a: "A2A",
  assistant: "助手",
};

function blockPoints(nodes: PipelineFlowNode[], id: string) {
  const node = nodes.find((row) => row.id === id);
  return node?.type === "worksetBlock" ? node.data.block.points : [];
}

describe("worksetPipelineGraph", () => {
  it("lists workset and task points and wires a task to its owning workset", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [
        { id: "__user__", name: "一般", notifyEnabled: true, externalEnabled: true },
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
    expect(worksets?.points.map((point) => point.entityId)).toEqual(["__user__", "ws-1"]);
    expect(tasks?.points.map((point) => point.entityId)).toEqual(["t1"]);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: taskPointId("t1"),
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: taskPointId("t1"),
        targetPointId: PIPELINE_PAGE.intel,
        muted: false,
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: taskPointId("t1"),
        targetPointId: PIPELINE_PAGE.timeline,
        muted: true,
      }),
    );
  });

  it("keeps intel edges when outputAnalysisEvents is off and dims them", () => {
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

    expect(
      graph.edges.find(
        (edge) => edge.sourcePointId === taskPointId("on") && edge.targetPointId === PIPELINE_PAGE.intel,
      )?.muted,
    ).toBe(false);
    expect(
      graph.edges.find(
        (edge) => edge.sourcePointId === taskPointId("off") && edge.targetPointId === PIPELINE_PAGE.intel,
      )?.muted,
    ).toBe(true);
  });

  it("does not wire leaderboard tasks to 情报页; notify stays", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [
        {
          id: "lb",
          name: "Board",
          analysisMode: "leaderboard",
          worksetId: "ws-1",
          outputAnalysisEvents: true,
          notifyPref: "follow",
        },
      ],
      items: [],
      sources: [],
      events: [],
      labels,
    });

    expect(
      graph.edges.find(
        (edge) => edge.sourcePointId === taskPointId("lb") && edge.targetPointId === PIPELINE_PAGE.intel,
      ),
    ).toBeUndefined();
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: taskPointId("lb"),
        targetPointId: PIPELINE_PAGE.notify,
        muted: false,
      }),
    );
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

  it("keeps MCP and A2A as the only external points and places assistant in layer 1", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: false }],
      tasks: [],
      items: [],
      sources: [],
      events: [],
      labels,
    });

    const external = graph.blocks.find((block) => block.kind === "external");
    const assistant = graph.blocks.find((block) => block.kind === "assistant");
    expect(external?.points.map((point) => point.id)).toEqual([
      PIPELINE_PAGE.mcp,
      PIPELINE_PAGE.a2a,
    ]);
    expect(external?.column).toBe(3);
    expect(assistant?.column).toBe(0);
    expect(assistant?.points.map((point) => point.id)).toEqual([PIPELINE_PAGE.assistant]);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: worksetPointId("ws-1"),
        targetPointId: PIPELINE_PAGE.mcp,
        muted: true,
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: worksetPointId("ws-1"),
        targetPointId: PIPELINE_PAGE.a2a,
        muted: true,
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: PIPELINE_PAGE.calendar,
      }),
    );
    expect(graph.edges.some((edge) => edge.targetPointId === PIPELINE_PAGE.assistant)).toBe(false);
    expect(graph.edges.some((edge) => edge.targetPointId === "page:webhook")).toBe(false);
    expect(graph.edges.some((edge) => edge.targetPointId === "page:deeplink")).toBe(false);
  });

  it("wires a task with no worksetId onto 一般, not an unassigned node", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [
        { id: "__user__", name: "一般", notifyEnabled: true, externalEnabled: true },
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
        targetPointId: worksetPointId("__user__"),
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
      blockNodes.every((node) =>
        node.data.block.points.length === 0 ? node.connectable === false : node.connectable === true,
      ),
    ).toBe(true);
    expect(flow.nodes.filter((node) => node.type === "layerZone").every((node) => node.connectable === false)).toBe(
      true,
    );
    expect(flow.nodes.filter((node) => node.type === "layerZone")).toHaveLength(4);
    expect(blockNodes.every((node) => node.style.pointerEvents === "all")).toBe(true);
    expect(blockNodes.every((node) => node.zIndex === 4)).toBe(true);
    expect(blockNodes.every((node) => node.className.includes("nopan"))).toBe(true);
    expect(blockNodes.some((node) => node.id === "block-worksets")).toBe(true);
    expect(blockNodes.some((node) => node.id === "block-tasks")).toBe(true);
    expect(new Set(blockNodes.map((node) => node.position.x)).size).toBeLessThanOrEqual(4);
    const intelEdge = flow.edges.find((row) => row.id === `${taskPointId("t1")}->${PIPELINE_PAGE.intel}`);
    expect(intelEdge?.sourceHandle).toBe("task:t1__out");
    expect(intelEdge?.targetHandle).toBe("page:intel__in");
    expect(intelEdge?.type).toBe("smoothstep");
    expect(intelEdge?.type).toBe(PIPELINE_EDGE_TYPE);
    expect(intelEdge?.data?.detour).toBeTruthy();
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
    const legal = new Set([worksetPointId("ws-1"), PIPELINE_PAGE.intel]);
    const flow = layoutPipelineFlow(graph, taskPointId("t1"), legal);
    const tasks = blockPoints(flow.nodes, "block-tasks");
    const worksets = blockPoints(flow.nodes, "block-worksets");
    const intel = blockPoints(flow.nodes, "block-intel");
    const external = blockPoints(flow.nodes, "block-external");
    expect(tasks.find((point) => point.id === taskPointId("t1"))?.muted).toBe(false);
    expect(worksets.find((point) => point.id === worksetPointId("ws-1"))?.legalTarget).toBe(true);
    expect(intel.find((point) => point.id === PIPELINE_PAGE.intel)?.legalTarget).toBe(true);
    expect(external.find((point) => point.id === PIPELINE_PAGE.mcp)?.muted).toBe(true);
    expect(external.find((point) => point.id === PIPELINE_PAGE.mcp)?.legalTarget).toBe(false);
    expect(external.find((point) => point.id === "page:webhook")).toBeUndefined();
  });

  it("keeps a four-column layout: 第一層…第四層", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "__user__", name: "一般", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [{ id: "item-123", title: "123", worksetId: "__user__" }],
      sources: [],
      events: [],
      labels,
    });

    const byKind = Object.fromEntries(graph.blocks.map((block) => [block.kind, block]));
    expect(byKind.sources?.column).toBe(0);
    expect(byKind.assistant?.column).toBe(0);
    expect(byKind.items?.column).toBe(1);
    expect(byKind.tasks?.column).toBe(1);
    expect(byKind.tasks?.points).toEqual([]);
    expect(byKind.itemEvents).toBeUndefined();
    expect(byKind.worksets?.column).toBe(2);
    expect(byKind.intel?.column).toBe(3);
    expect(byKind.timeline?.column).toBe(3);
    expect(byKind.calendar?.column).toBe(1);
    expect(byKind.calendar?.points.map((point) => point.id)).toEqual([PIPELINE_PAGE.calendar]);
    expect(byKind.calendar?.points[0]?.label).toBe("我的日程");
    expect(byKind.notify?.column).toBe(3);
    expect(byKind.external?.column).toBe(3);

    const flow = layoutPipelineFlow(graph);
    const blockX = (id: string) => flow.nodes.find((node) => node.id === id)?.position.x;
    expect(blockX(PIPELINE_BLOCK.sources)).toBe(PIPELINE_COL_X[0]);
    expect(blockX(PIPELINE_BLOCK.assistant)).toBe(PIPELINE_COL_X[0]);
    expect(blockX(PIPELINE_BLOCK.tasks)).toBe(PIPELINE_COL_X[1]);
    expect(blockX(PIPELINE_BLOCK.items)).toBe(PIPELINE_COL_X[1]);
    expect(blockX(PIPELINE_BLOCK.calendar)).toBe(PIPELINE_COL_X[1]);
    expect(blockX(PIPELINE_BLOCK.worksets)).toBe(PIPELINE_COL_X[2]);
    expect(blockX(PIPELINE_BLOCK.intel)).toBe(PIPELINE_COL_X[3]);
    expect(PIPELINE_COL_X[1] - PIPELINE_COL_X[0]).toBe(PIPELINE_ZONE_WIDTH + PIPELINE_COL_GAP_X);
    expect(PIPELINE_COL_GAP_X).toBe(64);
    expect(flow.nodes.filter((node) => node.type === "layerZone")).toHaveLength(4);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === itemPointId("item-123") && edge.targetPointId === worksetPointId("__user__"),
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === itemPointId("item-123") && edge.targetPointId === PIPELINE_PAGE.calendar,
      ),
    ).toBe(false);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: itemPointId("item-123"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: worksetPointId("__user__"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: PIPELINE_PAGE.calendar,
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.calendar,
        targetPointId: worksetPointId("__user__"),
      }),
    );
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
    });

    const calendar = graph.blocks.find((block) => block.kind === "calendar");
    const tasks = graph.blocks.find((block) => block.kind === "tasks");
    expect(graph.blocks.find((block) => block.kind === "itemEvents")).toBeUndefined();
    expect(calendar?.column).toBe(1);
    expect(calendar?.points.map((point) => point.id)).toEqual([PIPELINE_PAGE.calendar]);
    expect(calendar?.points[0]?.label).toBe("我的日程");
    expect(tasks?.column).toBe(1);
    expect(graph.blocks.find((block) => block.kind === "items")?.column).toBe(1);
    expect(graph.blocks.find((block) => block.kind === "worksets")?.column).toBe(2);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: itemPointId("item-1"),
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.calendar,
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: itemPointId("item-1"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.assistant,
        targetPointId: PIPELINE_PAGE.calendar,
      }),
    );
    expect(graph.edges.some((edge) => edge.sourcePointId.startsWith("itemEvent:"))).toBe(false);
    expect(graph.edges.some((edge) => edge.targetPointId.startsWith("itemEvent:"))).toBe(false);
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === worksetPointId("ws-1") &&
          (edge.targetPointId.startsWith("itemEvent:") ||
            edge.targetPointId.startsWith("calendar:") ||
            edge.targetPointId === PIPELINE_PAGE.calendar),
      ),
    ).toBe(false);
  });

  it("scopes the graph to one workset while keeping feeding sources and output pages", () => {
    const input: PipelineGraphInput = {
      worksets: [
        { id: "__user__", name: "一般", notifyEnabled: true, externalEnabled: true },
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
        { id: "t2", name: "Inbox", worksetId: "__user__", outputAnalysisEvents: true, notifyPref: "off" },
      ],
      items: [
        { id: "item-ops", title: "Ops item", worksetId: "ws-1" },
        { id: "item-gen", title: "General item", worksetId: "__user__" },
      ],
      sources: [
        { id: "src-1", name: "News" },
        { id: "src-2", name: "Other" },
      ],
      channels: [{ channelId: "telegram:42", sourceId: "src-1" }],
      events: [
        { id: "ev-ops", title: "Ops cal", worksetId: "ws-1" },
        { id: "ev-gen", title: "General cal", worksetId: "__user__" },
      ],
      labels,
    };
    const graph = buildWorksetPipelineGraph(scopePipelineInputToWorkset(input, "ws-1"));
    const pointIds = graph.blocks.flatMap((block) => block.points.map((point) => point.id));
    expect(pointIds).toContain(taskPointId("t1"));
    expect(pointIds).toContain(itemPointId("item-ops"));
    expect(pointIds).toContain(worksetPointId("ws-1"));
    expect(pointIds).toContain(sourcePointId("src-1"));
    expect(pointIds).toContain(PIPELINE_PAGE.intel);
    expect(pointIds).toContain(PIPELINE_PAGE.calendar);
    expect(pointIds).not.toContain(taskPointId("t2"));
    expect(pointIds).not.toContain(itemPointId("item-gen"));
    expect(pointIds).not.toContain(worksetPointId("__user__"));
    expect(pointIds).not.toContain(sourcePointId("src-2"));
    expect(pointIds).not.toContain("calendar:ev-ops");
    expect(pointIds).not.toContain("calendar:ev-gen");
    expect(graph.edges.every((edge) => pointIds.includes(edge.sourcePointId) && pointIds.includes(edge.targetPointId))).toBe(
      true,
    );
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

  it("fans each workset to 时间规划 but not to intel", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "__user__", name: "一般", notifyEnabled: true, externalEnabled: true }],
      tasks: [
        {
          id: "t1",
          name: "Scan",
          worksetId: "__user__",
          outputAnalysisEvents: true,
          includeInTimeline: true,
        },
      ],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    expect(
      graph.edges.some(
        (edge) =>
          edge.sourcePointId === worksetPointId("__user__") && edge.targetPointId === PIPELINE_PAGE.intel,
      ),
    ).toBe(false);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: worksetPointId("__user__"),
        targetPointId: PIPELINE_PAGE.timeline,
        muted: false,
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: taskPointId("t1"),
        targetPointId: PIPELINE_PAGE.intel,
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: worksetPointId("__user__"),
        targetPointId: PIPELINE_PAGE.notify,
      }),
    );
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: worksetPointId("__user__"),
        targetPointId: PIPELINE_PAGE.mcp,
      }),
    );
  });

  it("keeps an empty 任务 block and a compact 我的日程 page-point in 第二層", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const tasks = graph.blocks.find((block) => block.kind === "tasks");
    const calendar = graph.blocks.find((block) => block.kind === "calendar");
    const sources = graph.blocks.find((block) => block.kind === "sources");
    expect(graph.blocks.find((block) => block.kind === "itemEvents")).toBeUndefined();
    expect(tasks?.points).toEqual([]);
    expect(sources?.points).toEqual([]);
    expect(calendar?.column).toBe(1);
    expect(calendar?.points).toEqual([
      expect.objectContaining({ id: PIPELINE_PAGE.calendar, kind: "page", label: "我的日程" }),
    ]);
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        sourcePointId: PIPELINE_PAGE.calendar,
        targetPointId: worksetPointId("ws-1"),
      }),
    );
    expect(pipelineBlockHeight(0)).toBeLessThan(pipelineBlockHeight(1));
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
    expect(tokens).toEqual([
      "var(--info)",
      "var(--warning)",
      "var(--success)",
      "var(--accent)",
    ]);
    expect(new Set(tokens).size).toBe(4);
    expect(css).toContain("height: 30px;");
    expect(css).toContain("height: 24px;");
    expect(css).toContain("--im-ws-graph-zone-width: 188px;");
    expect(css).toContain("--im-ws-graph-col-gap-x: 64px;");
    expect(css).toContain("z-index: 2;");
    expect(css).not.toContain("is-layer5");
    expect(css).not.toContain(".im-ws-graph-filter");

    const panel = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../../pages/worksets/WorksetPipelineGraphPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("type: PIPELINE_EDGE_TYPE");
    expect(panel).toContain("ConnectionLineType.SmoothStep");
    expect(panel).not.toContain('type: "default"');
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
      linked.edges.some(
        (edge) =>
          edge.sourcePointId === itemPointId("item-1") &&
          edge.targetPointId === PIPELINE_PAGE.calendar,
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
    const emptyTasks = layoutPipelineFlow(unlinked).nodes.find(
      (node) => node.id === PIPELINE_BLOCK.tasks,
    );
    expect(emptyTasks?.type === "worksetBlock" && emptyTasks.connectable).toBe(false);
  });

  it("routes L2→L4 smoothstep edges around the workset card, not through it", () => {
    const graph = buildWorksetPipelineGraph({
      worksets: [{ id: "ws-1", name: "Ops", notifyEnabled: true, externalEnabled: true }],
      tasks: [{ id: "t1", name: "Scan", worksetId: "ws-1", outputAnalysisEvents: true, includeInTimeline: true }],
      items: [],
      sources: [],
      events: [],
      labels,
    });
    const flow = layoutPipelineFlow(graph);
    const workset = flow.nodes.find((node) => node.id === PIPELINE_BLOCK.worksets);
    expect(workset?.type).toBe("worksetBlock");
    if (workset?.type !== "worksetBlock") throw new Error("missing workset block");
    const box = {
      left: workset.position.x,
      right: workset.position.x + PIPELINE_BLOCK_WIDTH,
      top: workset.position.y,
      bottom: workset.position.y + Number(workset.style.height),
    };
    const detour = pipelineWorksetDetour({
      x: workset.position.x,
      y: workset.position.y,
      width: PIPELINE_BLOCK_WIDTH,
      height: Number(workset.style.height),
    });
    expect(detour.gutterLeft).toBeLessThan(box.left);
    expect(detour.gutterRight).toBeGreaterThan(box.right);
    expect(detour.gutterLeft).toBe(pipelineZoneX(2) - PIPELINE_COL_GAP_X / 2);

    const skipIds = [
      `${taskPointId("t1")}->${PIPELINE_PAGE.intel}`,
      `${taskPointId("t1")}->${PIPELINE_PAGE.timeline}`,
      `${taskPointId("t1")}->${PIPELINE_PAGE.notify}`,
    ];
    for (const id of skipIds) {
      const edge = flow.edges.find((row) => row.id === id);
      expect(edge?.type).toBe("smoothstep");
      expect(edge?.data?.detour).toEqual(detour);
    }
    const adjacent = flow.edges.find((row) => row.id === `${taskPointId("t1")}->${worksetPointId("ws-1")}`);
    expect(adjacent?.type).toBe("smoothstep");
    expect(adjacent?.data?.detour).toBeUndefined();

    const throughCard = pipelineSkipLayerWaypoints(box.left - 40, box.top + 20, box.right + 80, box.top + 20, detour);
    expect(pipelinePathHitsAabb(throughCard, box)).toBe(false);
    expect(flow.edges.every((edge) => edge.type === "smoothstep")).toBe(true);
    expect(flow.edges.some((edge) => (edge.type as string) === "default")).toBe(false);
  });
});
