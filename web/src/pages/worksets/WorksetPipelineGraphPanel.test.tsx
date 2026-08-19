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

vi.mock("../../speech", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../speech")>();
  return {
    ...actual,
    persistAssistantDefaultWorksetId: vi.fn(),
  };
});

import { listItems, updateItem } from "../../api/items";
import { listUserEventsPage } from "../../api/userEvents";
import { updateWorkset } from "../../api/worksets";
import { updateTask } from "../../api/tasks";
import {
  PIPELINE_PAGE,
  PIPELINE_VISIBLE_POINTS,
  buildWorksetPipelineGraph,
  itemPointId,
  pipelinePointHandleId,
  sourcePointId,
  taskPointId,
  worksetPointId,
  type PipelineGraphLabels,
} from "../../domain/worksets/worksetPipelineGraph";
import { persistAssistantDefaultWorksetId } from "../../speech";
import { WorksetPipelineGraphPanel } from "./WorksetPipelineGraphPanel";
import { applyPipelineGateToggle, applyPipelineHandleConnect, type GraphPatchDeps } from "./worksetGraphPatches";

const mockUpdateTask = vi.mocked(updateTask);
const mockUpdateItem = vi.mocked(updateItem);
const mockUpdateWorkset = vi.mocked(updateWorkset);
const mockListItems = vi.mocked(listItems);
const mockListUserEvents = vi.mocked(listUserEventsPage);
const mockPersistAssistantDefaultWorksetId = vi.mocked(persistAssistantDefaultWorksetId);

const graphLabels: PipelineGraphLabels = {
  generalName: "一般",
  unassigned: "未歸屬",
  more: (count) => `另 ${count} 項`,
  assistant: "助手",
  timeline: "時間規劃",
  intel: "情報頁",
  notify: "通知",
  external: "外部接口",
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
    mockUpdateWorkset.mockClear();
    mockPersistAssistantDefaultWorksetId.mockClear();
    mockListItems.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
    taskCatalogState.worksets = [
      {
        id: "__general__",
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

    expect(harness.container.querySelector('[data-testid="workset-pipeline-graph"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-workset-ws-1"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-task-t1"]')).toBeTruthy();
  });

  it("PATCHes when clicking a task then a legal workset", async () => {
    await flushGraph(harness);

    const taskPoint = harness.container.querySelector(
      '[data-testid="workset-graph-point-task-t1"]',
    ) as HTMLButtonElement;
    const general = harness.container.querySelector(
      '[data-testid="workset-graph-point-workset-__general__"]',
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
      '[data-testid="workset-graph-point-workset-__general__"]',
    ) as HTMLButtonElement;
    expect(generalAfter.closest(".im-ws-graph-point")?.getAttribute("data-legal-target")).toBe("true");

    await act(async () => {
      generalAfter.click();
      await Promise.resolve();
    });

    expect(mockUpdateTask).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ worksetId: "__general__" }),
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
      { id: "item-gen", title: "General item", worksetId: "__general__", status: "active" },
    ] as Awaited<ReturnType<typeof listItems>>);
    taskCatalogState.tasks = [
      ...taskCatalogState.tasks,
      makeAnalysisTask({
        id: "t2",
        name: "Inbox",
        worksetId: "__general__",
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
    expect(harness.container.querySelector('[data-testid="workset-graph-point-workset-__general__"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-page-page:intel"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-point-page-page:assistant"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-block-calendar"]')).toBeNull();
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
      `[data-handleid="${pipelinePointHandleId(worksetPointId("__general__"), "in")}"]`,
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
        targetHandle: pipelinePointHandleId(worksetPointId("__general__"), "in"),
      },
      catalogGraph(),
      catalogConnectData(),
      silentPatchDeps(),
    );
    expect(result).toBe("connected");
    expect(mockUpdateTask).toHaveBeenCalledWith("t1", expect.objectContaining({ worksetId: "__general__" }));
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
        targetHandle: pipelinePointHandleId(worksetPointId("__general__"), "in"),
      },
      graph,
      data,
      silentPatchDeps(),
    );
    expect(itemWorkset).toBe("connected");
    expect(mockUpdateItem).toHaveBeenCalledWith("item-1", expect.objectContaining({ worksetId: "__general__" }));
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

  it("click-connects assistant to one workset as the voice default", async () => {
    await flushGraph(harness);

    const assistantPoint = harness.container.querySelector(
      '[data-testid="workset-graph-point-page-page:assistant"]',
    ) as HTMLButtonElement;
    const ops = harness.container.querySelector(
      '[data-testid="workset-graph-point-workset-ws-1"]',
    ) as HTMLButtonElement;
    expect(assistantPoint).toBeTruthy();
    expect(ops).toBeTruthy();

    await act(async () => {
      assistantPoint.click();
    });
    expect(harness.container.querySelector('[data-testid="workset-graph-connect-hint"]')?.textContent).toContain(
      "點選工作集以設為語音預設歸屬",
    );
    const opsAfter = harness.container.querySelector(
      '[data-testid="workset-graph-point-workset-ws-1"]',
    ) as HTMLButtonElement;
    expect(opsAfter.closest(".im-ws-graph-point")?.getAttribute("data-legal-target")).toBe("true");

    await act(async () => {
      opsAfter.click();
      await Promise.resolve();
    });

    expect(mockPersistAssistantDefaultWorksetId).toHaveBeenCalledWith("ws-1");
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("onConnect writes the voice default for assistant→workset", async () => {
    await flushGraph(harness);
    const deps = silentPatchDeps();
    const result = await applyPipelineHandleConnect(
      {
        sourceHandle: pipelinePointHandleId(PIPELINE_PAGE.assistant, "out"),
        targetHandle: pipelinePointHandleId(worksetPointId("ws-1"), "in"),
      },
      catalogGraph(),
      { ...catalogConnectData(), assistantDefaultWorksetId: "__general__" },
      deps,
    );
    expect(result).toBe("connected");
    expect(mockPersistAssistantDefaultWorksetId).toHaveBeenCalledWith("ws-1");
    expect(deps.reloadGraph).toHaveBeenCalled();
  });

  it("onConnect no-ops assistant→current default without writing", async () => {
    await flushGraph(harness);
    const result = await applyPipelineHandleConnect(
      {
        sourceHandle: pipelinePointHandleId(PIPELINE_PAGE.assistant, "out"),
        targetHandle: pipelinePointHandleId(worksetPointId("__general__"), "in"),
      },
      catalogGraph(),
      { ...catalogConnectData(), assistantDefaultWorksetId: "__general__" },
      silentPatchDeps(),
    );
    expect(result).toBe("connected");
    expect(mockPersistAssistantDefaultWorksetId).not.toHaveBeenCalled();
  });

  it("PATCHes includeInTimeline when the task calendar icon is clicked", async () => {
    await flushGraph(harness);
    const calendar = harness.container.querySelector(
      '[data-testid="workset-graph-gate-calendar-task-t1"]',
    ) as HTMLButtonElement;
    expect(calendar.tagName).toBe("BUTTON");
    expect(calendar.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      calendar.click();
      await Promise.resolve();
    });

    expect(mockUpdateTask).toHaveBeenCalledWith("t1", expect.objectContaining({ includeInTimeline: true }));
    expect(harness.container.querySelector('[data-testid="workset-graph-connect-hint"]')).toBeNull();
  });

  it("shows a calendar-write icon on agent tasks only", async () => {
    taskCatalogState.tasks = [
      makeAnalysisTask({
        id: "agent-1",
        name: "Reconcile",
        analysisMode: "agent",
        worksetId: "ws-1",
        outputAnalysisEvents: true,
        includeInTimeline: true,
        outputCalendar: false,
        notifyPref: "off",
      }),
      makeAnalysisTask({
        id: "intel-1",
        name: "Scan",
        analysisMode: "intel_event",
        worksetId: "ws-1",
        outputAnalysisEvents: true,
        includeInTimeline: true,
        outputCalendar: true,
        notifyPref: "off",
      }),
      makeAnalysisTask({
        id: "lb-1",
        name: "Board",
        analysisMode: "leaderboard",
        worksetId: "ws-1",
        outputAnalysisEvents: true,
        includeInTimeline: true,
        outputCalendar: true,
        notifyPref: "inherit",
      }),
    ];
    await flushGraph(harness);

    const agentWrite = harness.container.querySelector(
      '[data-testid="workset-graph-gate-calendarWrite-task-agent-1"]',
    ) as HTMLButtonElement;
    expect(agentWrite).toBeTruthy();
    expect(agentWrite.tagName).toBe("BUTTON");
    expect(agentWrite.getAttribute("aria-pressed")).toBe("false");
    expect(harness.container.querySelector('[data-testid="workset-graph-gate-calendar-task-agent-1"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-gate-calendarWrite-task-intel-1"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-gate-calendarWrite-task-lb-1"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="workset-graph-gate-calendar-task-intel-1"]')).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-gate-calendar-task-lb-1"]')).toBeTruthy();
  });

  it("PATCHes outputCalendar when the agent calendar-write icon is clicked", async () => {
    taskCatalogState.tasks = [
      makeAnalysisTask({
        id: "agent-1",
        name: "Reconcile",
        analysisMode: "agent",
        worksetId: "ws-1",
        outputAnalysisEvents: true,
        includeInTimeline: true,
        outputCalendar: false,
        notifyPref: "off",
      }),
    ];
    await flushGraph(harness);
    const calendarWrite = harness.container.querySelector(
      '[data-testid="workset-graph-gate-calendarWrite-task-agent-1"]',
    ) as HTMLButtonElement;
    expect(calendarWrite).toBeTruthy();

    await act(async () => {
      calendarWrite.click();
      await Promise.resolve();
    });

    expect(mockUpdateTask).toHaveBeenCalledWith("agent-1", expect.objectContaining({ outputCalendar: true }));
    expect(mockUpdateTask).not.toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({ includeInTimeline: expect.anything() }),
    );
  });

  it("PATCHes notifyPref and outputAnalysisEvents from task gate icons", async () => {
    await flushGraph(harness);
    const notify = harness.container.querySelector(
      '[data-testid="workset-graph-gate-notify-task-t1"]',
    ) as HTMLButtonElement;
    const intel = harness.container.querySelector(
      '[data-testid="workset-graph-gate-intel-task-t1"]',
    ) as HTMLButtonElement;

    await act(async () => {
      notify.click();
      await Promise.resolve();
    });
    expect(mockUpdateTask).toHaveBeenCalledWith("t1", expect.objectContaining({ notifyPref: "inherit" }));

    mockUpdateTask.mockClear();
    await act(async () => {
      intel.click();
      await Promise.resolve();
    });
    expect(mockUpdateTask).toHaveBeenCalledWith("t1", expect.objectContaining({ outputAnalysisEvents: false }));
  });

  it("PATCHes workset notify and external from workset gate icons", async () => {
    await flushGraph(harness);
    const notify = harness.container.querySelector(
      '[data-testid="workset-graph-gate-notify-workset-ws-1"]',
    ) as HTMLButtonElement;
    const external = harness.container.querySelector(
      '[data-testid="workset-graph-gate-external-workset-ws-1"]',
    ) as HTMLButtonElement;

    await act(async () => {
      notify.click();
      await Promise.resolve();
    });
    expect(mockUpdateWorkset).toHaveBeenCalledWith("ws-1", { notifyEnabled: false });

    mockUpdateWorkset.mockClear();
    await act(async () => {
      external.click();
      await Promise.resolve();
    });
    expect(mockUpdateWorkset).toHaveBeenCalledWith("ws-1", { externalEnabled: false });
  });

  it("ignores status-only item and assistant calendar icons", async () => {
    const items = [{ id: "item-1", title: "Milk", worksetId: "ws-1" }];
    const result = await applyPipelineGateToggle(
      { id: itemPointId("item-1"), kind: "item", entityId: "item-1", label: "Milk", href: "/items/item-1/edit" },
      "calendar",
      { ...catalogConnectData(), items },
      silentPatchDeps(),
    );
    expect(result).toBe("ignored");
    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockUpdateWorkset).not.toHaveBeenCalled();

    const assistantResult = await applyPipelineGateToggle(
      {
        id: PIPELINE_PAGE.assistant,
        kind: "page",
        entityId: PIPELINE_PAGE.assistant,
        label: "助手",
        href: "/assistant",
      },
      "calendar",
      catalogConnectData(),
      silentPatchDeps(),
    );
    expect(assistantResult).toBe("ignored");
  });

  it("applyPipelineGateToggle PATCHes the same fields as the old connect gates", async () => {
    const taskPoint = {
      id: taskPointId("t1"),
      kind: "task" as const,
      entityId: "t1",
      label: "Scan",
      href: "/tasks/t1/edit",
    };
    const data = catalogConnectData();
    const deps = silentPatchDeps();

    expect(await applyPipelineGateToggle(taskPoint, "calendar", data, deps)).toBe("toggled");
    expect(mockUpdateTask).toHaveBeenCalledWith("t1", expect.objectContaining({ includeInTimeline: true }));

    mockUpdateTask.mockClear();
    expect(await applyPipelineGateToggle(taskPoint, "notify", data, deps)).toBe("toggled");
    expect(mockUpdateTask).toHaveBeenCalledWith("t1", expect.objectContaining({ notifyPref: "inherit" }));

    mockUpdateTask.mockClear();
    expect(await applyPipelineGateToggle(taskPoint, "intel", data, deps)).toBe("toggled");
    expect(mockUpdateTask).toHaveBeenCalledWith("t1", expect.objectContaining({ outputAnalysisEvents: false }));

    mockUpdateTask.mockClear();
    expect(await applyPipelineGateToggle(taskPoint, "calendarWrite", data, deps)).toBe("ignored");
    expect(mockUpdateTask).not.toHaveBeenCalled();

    const agentPoint = {
      id: taskPointId("agent-1"),
      kind: "task" as const,
      entityId: "agent-1",
      label: "Reconcile",
      href: "/tasks/agent-1/agent",
    };
    const agentData = {
      ...data,
      tasks: [
        ...data.tasks,
        makeAnalysisTask({
          id: "agent-1",
          name: "Reconcile",
          analysisMode: "agent",
          worksetId: "ws-1",
          outputAnalysisEvents: true,
          includeInTimeline: true,
          outputCalendar: false,
        }),
      ],
    };
    expect(await applyPipelineGateToggle(agentPoint, "calendarWrite", agentData, deps)).toBe("toggled");
    expect(mockUpdateTask).toHaveBeenCalledWith("agent-1", expect.objectContaining({ outputCalendar: true }));

    const worksetPoint = {
      id: worksetPointId("ws-1"),
      kind: "workset" as const,
      entityId: "ws-1",
      label: "Ops",
      href: "/worksets/ws-1",
    };
    expect(await applyPipelineGateToggle(worksetPoint, "notify", data, deps)).toBe("toggled");
    expect(mockUpdateWorkset).toHaveBeenCalledWith("ws-1", { notifyEnabled: false });
    expect(await applyPipelineGateToggle(worksetPoint, "external", data, deps)).toBe("toggled");
    expect(mockUpdateWorkset).toHaveBeenCalledWith("ws-1", { externalEnabled: false });
    expect(await applyPipelineGateToggle(worksetPoint, "calendar", data, deps)).toBe("ignored");
  });

  it("focuses a point or edge and clears on pane click or Escape", async () => {
    await flushGraph(harness);

    const graph = harness.container.querySelector('[data-testid="workset-pipeline-graph"]');
    expect(graph?.getAttribute("data-graph-focus")).toBe("none");

    const taskPoint = harness.container.querySelector(
      '[data-testid="workset-graph-point-task-t1"]',
    ) as HTMLButtonElement;
    await act(async () => {
      taskPoint.click();
    });
    expect(graph?.getAttribute("data-graph-focus")).toBe("point:task:t1");

    const pane = harness.container.querySelector(".react-flow__pane") as HTMLElement | null;
    expect(pane).toBeTruthy();
    await act(async () => {
      pane?.click();
    });
    expect(graph?.getAttribute("data-graph-focus")).toBe("none");

    await act(async () => {
      taskPoint.click();
    });
    expect(graph?.getAttribute("data-graph-focus")).toBe("point:task:t1");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(graph?.getAttribute("data-graph-focus")).toBe("none");

    const edge = harness.container.querySelector('.react-flow__edge[data-id="task:t1->workset:ws-1"]') as
      | HTMLElement
      | null;
    if (edge) {
      await act(async () => {
        edge.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      expect(graph?.getAttribute("data-graph-focus")).toBe("edge:task:t1->workset:ws-1");
      await act(async () => {
        pane?.click();
      });
      expect(graph?.getAttribute("data-graph-focus")).toBe("none");
    }
  });
});
