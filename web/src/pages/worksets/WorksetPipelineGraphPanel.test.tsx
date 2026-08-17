import { act, createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeAnalysisTask, mockShowToast, resetTaskCatalogState, taskCatalogState } from "../../test/context-mocks";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../api/items", () => ({
  listItems: vi.fn().mockResolvedValue([]),
  updateItem: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api/sources", () => ({
  listSources: vi.fn().mockResolvedValue([{ id: "src-1", name: "News" }]),
}));

vi.mock("../../api/channels", () => ({
  listChannelsWithSources: vi.fn().mockResolvedValue([
    { id: "telegram:42", sourceId: "src-1", platform: "telegram", platformId: "42" },
  ]),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEventsPage: vi.fn().mockResolvedValue({ items: [], totalCount: 0, hasMore: false }),
  updateUserEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api/tasks", () => ({
  updateTask: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api/worksets", () => ({
  updateWorkset: vi.fn().mockResolvedValue({}),
}));

import { listItems, updateItem } from "../../api/items";
import { listUserEventsPage } from "../../api/userEvents";
import { updateTask } from "../../api/tasks";
import {
  PIPELINE_VISIBLE_POINTS,
  buildWorksetPipelineGraph,
  itemPointId,
  pipelinePointHandleId,
  sourcePointId,
  taskPointId,
  worksetPointId,
  type PipelineGraphLabels,
} from "../../domain/worksets/worksetPipelineGraph";
import { WorksetPipelineGraphPanel } from "./WorksetPipelineGraphPanel";
import { applyPipelineHandleConnect, type GraphPatchDeps } from "./worksetGraphPatches";

const mockUpdateTask = vi.mocked(updateTask);
const mockUpdateItem = vi.mocked(updateItem);
const mockListItems = vi.mocked(listItems);
const mockListUserEvents = vi.mocked(listUserEventsPage);

const graphLabels: PipelineGraphLabels = {
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

function catalogConnectData() {
  return {
    worksets: taskCatalogState.worksets,
    tasks: taskCatalogState.tasks,
    items: [] as { id: string; title: string; worksetId: string }[],
    events: [] as { id: string; title: string; worksetId: string }[],
    channels: [{ channelId: "telegram:42", sourceId: "src-1" }],
  };
}

function catalogGraph(items: { id: string; title: string; worksetId: string }[] = []) {
  return buildWorksetPipelineGraph({
    ...catalogConnectData(),
    items,
    sources: [{ id: "src-1", name: "News" }],
    labels: graphLabels,
  });
}

function silentPatchDeps(): GraphPatchDeps {
  return {
    refreshTasks: vi.fn(),
    refreshWorksets: vi.fn(),
    reloadGraph: vi.fn(),
    onError: vi.fn(),
  };
}

function GraphAt({ entry = "/worksets?tab=graph" }: { entry?: string } = {}) {
  return createElement(
    MemoryRouter,
    { initialEntries: [entry] },
    createElement(WorksetPipelineGraphPanel),
  );
}

async function flushGraph(harness: TestHarness, entry = "/worksets?tab=graph") {
  await harness.render(GraphAt, { entry });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("WorksetPipelineGraphPanel", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
    resetTaskCatalogState();
    mockShowToast.mockReset();
    mockUpdateTask.mockClear();
    mockUpdateItem.mockClear();
    mockListItems.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
    taskCatalogState.worksets = [
      {
        id: "__user__",
        name: "一般",
        isSystem: true,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "ws-1",
        name: "Ops",
        isSystem: false,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    taskCatalogState.tasks = [
      makeAnalysisTask({
        id: "t1",
        name: "Scan",
        worksetId: "ws-1",
        outputAnalysisEvents: true,
        includeInTimeline: false,
        outputCalendar: false,
        notifyPref: "off",
        channelIds: ["telegram:42"],
      }),
    ];
  });

  afterEach(() => {
    harness.cleanup();
    document.body.querySelectorAll('[data-testid="workset-graph-point-modal"]').forEach((node) => {
      node.remove();
    });
  });

  it("renders workset and task points", async () => {
    await flushGraph(harness);

    const graph = harness.container.querySelector('[data-testid="workset-pipeline-graph"]');
    expect(graph).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-workset-ws-1"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-workset-__user__"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-task-t1"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-filter"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-zone-layer4"]')).toBeTruthy();
    const taskNode = harness.container.querySelector('[data-testid="rf__node-block-tasks"]') as HTMLElement | null;
    expect(taskNode?.style.pointerEvents).toBe("all");

    const edgeIds = graph?.getAttribute("data-edge-ids") ?? "";
    expect(edgeIds).toContain("task:t1->workset:ws-1");
    expect(edgeIds).toContain("task:t1->page:intel");
    expect(edgeIds).toContain("source:src-1->task:t1");
    expect(edgeIds).toContain("workset:ws-1->page:mcp");
    expect(edgeIds).toContain("workset:ws-1->page:a2a");
    expect(edgeIds).toContain("page:assistant->page:calendar");
    expect(edgeIds).toContain("page:assistant->workset:ws-1");
    expect(edgeIds).toContain("page:calendar->workset:ws-1");
    expect(edgeIds).toContain("page:calendar->workset:__user__");
    expect(edgeIds).not.toContain("workset:ws-1->page:intel");
    expect(edgeIds).not.toContain("workset:__user__->page:intel");
    expect(edgeIds).toContain("workset:ws-1->page:timeline");
    expect(edgeIds).toContain("workset:__user__->page:timeline");
    expect(edgeIds).not.toContain("page:webhook");
    expect(edgeIds).not.toContain("page:deeplink");
    expect(harness.container.querySelector('[data-testid="workset-graph-point-page-page:assistant"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-page-page:mcp"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-page-page:webhook"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-page-page:deeplink"]')).toBeNull();
  });

  it("PATCHes when clicking a task then a legal workset", async () => {
    await flushGraph(harness);

    const taskPoint = harness.container.querySelector(
      '[data-testid="workset-graph-point-task-t1"]',
    ) as HTMLButtonElement;
    const general = harness.container.querySelector(
      '[data-testid="workset-graph-point-workset-__user__"]',
    ) as HTMLButtonElement;
    expect(taskPoint).toBeTruthy();
    expect(general).toBeTruthy();

    await act(async () => {
      taskPoint.click();
    });
    expect(harness.container.querySelector('[data-testid="workset-graph-connect-hint"]')?.textContent).toContain(
      "點選工作集以歸屬此任務",
    );
    const generalAfter = harness.container.querySelector(
      '[data-testid="workset-graph-point-workset-__user__"]',
    ) as HTMLButtonElement;
    expect(generalAfter.closest(".im-ws-graph-point")?.getAttribute("data-legal-target")).toBe("true");

    await act(async () => {
      generalAfter.click();
      await Promise.resolve();
    });

    expect(mockUpdateTask).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ worksetId: "__user__" }),
    );
  });

  it("opens a settings dialog from the point settings button", async () => {
    await flushGraph(harness);

    const settings = harness.container.querySelector(
      '[data-testid="workset-graph-point-settings-task-t1"]',
    ) as HTMLButtonElement;
    expect(settings).toBeTruthy();
    await act(async () => {
      settings.click();
    });

    const dialog = document.body.querySelector('[data-testid="workset-graph-point-modal"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.querySelector('[data-testid="workset-graph-task-intel"]')).toBeTruthy();
    expect(dialog?.querySelector('[data-testid="workset-graph-open-page"]')).toBeTruthy();
    expect(dialog?.textContent).toContain("打開完整頁");
  });

  it("filters the canvas to one workset and hides other workset items", async () => {
    mockListItems.mockResolvedValue([
      { id: "item-ops", title: "Ops item", worksetId: "ws-1", status: "active" },
      { id: "item-gen", title: "General item", worksetId: "__user__", status: "active" },
    ] as Awaited<ReturnType<typeof listItems>>);
    taskCatalogState.tasks = [
      ...taskCatalogState.tasks,
      makeAnalysisTask({
        id: "t2",
        name: "Inbox",
        worksetId: "__user__",
        outputAnalysisEvents: true,
        includeInTimeline: true,
        outputCalendar: false,
        notifyPref: "off",
      }),
    ];
    await flushGraph(harness, "/worksets?tab=graph&worksetId=ws-1");

    expect(harness.container.querySelector('[data-testid="workset-pipeline-graph"]')?.getAttribute("data-filter-workset")).toBe(
      "ws-1",
    );
    expect(harness.container.querySelector('[data-testid="workset-graph-filter"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-task-t1"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-workset-ws-1"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-item-item-ops"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-task-t2"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-item-item-gen"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-workset-__user__"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-page-page:intel"]')).toBeTruthy();
  });

  it("does not fake a line from an unlinked item to 日程页", async () => {
    mockListItems.mockResolvedValue([
      { id: "item-123", title: "123", worksetId: "__user__", status: "active" },
    ] as Awaited<ReturnType<typeof listItems>>);
    await flushGraph(harness);

    const edgeIds =
      harness.container.querySelector('[data-testid="workset-pipeline-graph"]')?.getAttribute("data-edge-ids") ??
      "";
    expect(harness.container.querySelector('[data-testid="workset-graph-point-item-item-123"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-block-itemEvents"]')).toBeNull();
    expect(edgeIds).toContain("item:item-123->workset:__user__");
    expect(edgeIds).not.toContain("item:item-123->page:calendar");
  });

  it("keeps empty 任务 and puts 我的日程 in layer 2 with items and tasks", async () => {
    taskCatalogState.tasks = [];
    await flushGraph(harness);

    const tasks = harness.container.querySelector('[data-testid="workset-graph-block-tasks"]');
    const calendar = harness.container.querySelector('[data-testid="workset-graph-block-calendar"]');
    expect(tasks).toBeTruthy();
    expect(tasks?.getAttribute("data-layer")).toBe("layer2");
    expect(harness.container.querySelector('[data-testid="workset-graph-block-empty-tasks"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-block-itemEvents"]')).toBeNull();
    expect(calendar?.getAttribute("data-layer")).toBe("layer2");
    expect(harness.container.querySelector('[data-testid="workset-graph-point-page-page:calendar"]')?.textContent).toBe(
      "我的日程",
    );
    expect(harness.container.querySelector('[data-testid="workset-graph-block-sources"]')?.getAttribute("data-layer")).toBe(
      "layer1",
    );
    expect(harness.container.querySelector('[data-testid="workset-graph-block-assistant"]')?.getAttribute("data-layer")).toBe(
      "layer1",
    );
    expect(harness.container.querySelector('[data-testid="workset-graph-block-items"]')?.getAttribute("data-layer")).toBe(
      "layer2",
    );
    expect(harness.container.querySelector('[data-testid="workset-graph-block-worksets"]')?.getAttribute("data-layer")).toBe(
      "layer3",
    );
    expect(harness.container.querySelector('[data-testid="workset-graph-zone-layer3"]')?.textContent).toContain(
      "第三層",
    );
    expect(harness.container.querySelector('[data-testid="workset-graph-zone-layer4"]')?.textContent).toContain(
      "第四層",
    );
    expect(harness.container.querySelector('[data-testid="workset-graph-zone-layer5"]')).toBeNull();
    const zoneClasses = ["layer1", "layer2", "layer3", "layer4"].map(
      (layer) => harness.container.querySelector(`[data-testid="workset-graph-zone-${layer}"]`)?.className ?? "",
    );
    expect(zoneClasses.every((className) => className.includes("im-ws-graph-zone"))).toBe(true);
    expect(zoneClasses[0]).toContain("is-layer1");
    expect(zoneClasses[1]).toContain("is-layer2");
    expect(zoneClasses[2]).toContain("is-layer3");
    expect(zoneClasses[3]).toContain("is-layer4");
    expect(new Set(zoneClasses).size).toBe(4);
  });

  it("wires items to worksets and keeps 我的日程 in layer 2", async () => {
    mockListItems.mockResolvedValue([
      { id: "item-123", title: "123", worksetId: "__user__", status: "active" },
    ] as Awaited<ReturnType<typeof listItems>>);
    mockListUserEvents.mockResolvedValue({
      items: [
        {
          id: "ev-exp",
          title: "Milk expires",
          startTime: "2026-09-01T09:00:00Z",
          endTime: null,
          body: "",
          location: null,
          origin: "manual",
          isAllDay: false,
          taskId: "",
          worksetId: "__user__",
          itemId: "item-123",
          kind: "expires",
          notifyPref: "follow",
          source: "user",
          dismissed: false,
          important: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
      totalCount: 1,
      hasMore: false,
    } as Awaited<ReturnType<typeof listUserEventsPage>>);
    await flushGraph(harness);

    const calendar = harness.container.querySelector('[data-testid="workset-graph-block-calendar"]');
    const items = harness.container.querySelector('[data-testid="workset-graph-block-items"]');
    expect(harness.container.querySelector('[data-testid="workset-graph-block-itemEvents"]')).toBeNull();
    expect(calendar?.getAttribute("data-layer")).toBe("layer2");
    expect(items?.getAttribute("data-layer")).toBe("layer2");
    expect(harness.container.querySelector('[data-testid="workset-graph-block-worksets"]')?.getAttribute("data-layer")).toBe(
      "layer3",
    );
    expect(harness.container.querySelector('[data-testid="workset-graph-point-itemEvent-ev-exp"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-item-item-123"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-page-page:calendar"]')).toBeTruthy();
    const edgeIds = harness.container.querySelector('[data-testid="workset-pipeline-graph"]')?.getAttribute("data-edge-ids") ?? "";
    expect(edgeIds).toContain("item:item-123->workset:__user__");
    expect(edgeIds).toContain("page:calendar->workset:__user__");
    expect(edgeIds).not.toContain("item:item-123->itemEvent:ev-exp");
    expect(edgeIds).not.toContain("itemEvent:ev-exp->workset:__user__");
    expect(edgeIds).not.toContain("item:item-123->page:calendar");
    expect(edgeIds).not.toContain("workset:__user__->itemEvent:");
    expect(edgeIds).not.toContain("workset:__user__->calendar:");
    expect(edgeIds).not.toContain("workset:__user__->page:calendar");
  });

  it("collapses overflow points inside a block until expanded", async () => {
    taskCatalogState.tasks = Array.from({ length: PIPELINE_VISIBLE_POINTS + 2 }, (_, index) =>
      makeAnalysisTask({
        id: `t${index + 1}`,
        name: `Task ${index + 1}`,
        worksetId: "ws-1",
        outputAnalysisEvents: true,
        includeInTimeline: false,
        outputCalendar: false,
        notifyPref: "off",
      }),
    );
    await flushGraph(harness);

    expect(harness.container.querySelector('[data-testid="workset-graph-point-task-t1"]')).toBeTruthy();
    expect(
      harness.container.querySelector(`[data-testid="workset-graph-point-task-t${PIPELINE_VISIBLE_POINTS}"]`),
    ).toBeTruthy();
    expect(
      harness.container.querySelector(`[data-testid="workset-graph-point-task-t${PIPELINE_VISIBLE_POINTS + 1}"]`),
    ).toBeNull();
    const overflow = harness.container.querySelector(
      '[data-testid="workset-graph-overflow-tasks"]',
    ) as HTMLButtonElement;
    expect(overflow).toBeTruthy();
    expect(overflow.textContent).toContain("其餘 2");

    await act(async () => {
      overflow.click();
    });
    expect(
      harness.container.querySelector(`[data-testid="workset-graph-point-task-t${PIPELINE_VISIBLE_POINTS + 1}"]`),
    ).toBeTruthy();
    expect(overflow.getAttribute("aria-expanded")).toBe("true");
  });

  it("exposes grab-able handles whose ids match onConnect mapping", async () => {
    await flushGraph(harness);

    const outHandle = harness.container.querySelector(
      `[data-handleid="${pipelinePointHandleId(taskPointId("t1"), "out")}"]`,
    ) as HTMLElement | null;
    const inHandle = harness.container.querySelector(
      `[data-handleid="${pipelinePointHandleId(worksetPointId("__user__"), "in")}"]`,
    ) as HTMLElement | null;
    expect(outHandle).toBeTruthy();
    expect(inHandle).toBeTruthy();
    expect(outHandle?.style.pointerEvents).not.toBe("none");
    expect(inHandle?.style.pointerEvents).not.toBe("none");
    expect(outHandle?.getAttribute("title")).toContain("從圓點拉線連接");
    expect(outHandle?.style.top).toBe("46px");
    expect(inHandle?.style.top).toBe("46px");
    const settings = harness.container.querySelector(
      '[data-testid="workset-graph-point-settings-task-t1"]',
    ) as HTMLButtonElement;
    expect(settings).toBeTruthy();
    expect(settings.style.pointerEvents).not.toBe("none");
  });

  it("onConnect PATCHes a legal task→workset pair", async () => {
    await flushGraph(harness);
    const result = await applyPipelineHandleConnect(
      {
        sourceHandle: pipelinePointHandleId(taskPointId("t1"), "out"),
        targetHandle: pipelinePointHandleId(worksetPointId("__user__"), "in"),
      },
      catalogGraph(),
      catalogConnectData(),
      silentPatchDeps(),
    );
    expect(result).toBe("connected");
    expect(mockUpdateTask).toHaveBeenCalledWith("t1", expect.objectContaining({ worksetId: "__user__" }));
  });

  it("onConnect does not PATCH an illegal source→workset or item→task pair", async () => {
    await flushGraph(harness);
    const items = [{ id: "item-1", title: "Milk", worksetId: "ws-1" }];
    const data = { ...catalogConnectData(), items };
    const graph = catalogGraph(items);

    const sourceWorkset = await applyPipelineHandleConnect(
      {
        sourceHandle: pipelinePointHandleId(sourcePointId("src-1"), "out"),
        targetHandle: pipelinePointHandleId(worksetPointId("ws-1"), "in"),
      },
      graph,
      data,
      silentPatchDeps(),
    );
    expect(sourceWorkset).toBe("illegal");

    const itemTask = await applyPipelineHandleConnect(
      {
        sourceHandle: pipelinePointHandleId(itemPointId("item-1"), "out"),
        targetHandle: pipelinePointHandleId(taskPointId("t1"), "in"),
      },
      graph,
      data,
      silentPatchDeps(),
    );
    expect(itemTask).toBe("illegal");

    const itemWorkset = await applyPipelineHandleConnect(
      {
        sourceHandle: pipelinePointHandleId(itemPointId("item-1"), "out"),
        targetHandle: pipelinePointHandleId(worksetPointId("__user__"), "in"),
      },
      graph,
      data,
      silentPatchDeps(),
    );
    expect(itemWorkset).toBe("connected");
    expect(mockUpdateItem).toHaveBeenCalledWith("item-1", expect.objectContaining({ worksetId: "__user__" }));
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("onConnect no-ops when the legal pair is already connected", async () => {
    await flushGraph(harness);
    const result = await applyPipelineHandleConnect(
      {
        sourceHandle: pipelinePointHandleId(taskPointId("t1"), "out"),
        targetHandle: pipelinePointHandleId(worksetPointId("ws-1"), "in"),
      },
      catalogGraph(),
      catalogConnectData(),
      silentPatchDeps(),
    );
    expect(result).toBe("connected");
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });
});
