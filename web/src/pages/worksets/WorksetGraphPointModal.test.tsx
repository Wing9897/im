import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeAnalysisTask, resetTaskCatalogState, taskCatalogState } from "../../test/context-mocks";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import type { PipelinePoint } from "../../domain/worksets/worksetPipelineGraph";
import type { WorksetPipelineGraphData } from "./useWorksetPipelineGraphData";

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../api/tasks", () => ({
  updateTask: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api/items", () => ({
  updateItem: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api/userEvents", () => ({
  updateUserEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../api/worksets", () => ({
  updateWorkset: vi.fn().mockResolvedValue({}),
}));

import { WorksetGraphPointModal } from "./WorksetGraphPointModal";

const labels: WorksetPipelineGraphData["labels"] = {
  generalName: "一般",
  unassigned: "未歸屬",
  more: (count) => `另 ${count} 項`,
  assistant: "助手",
  timeline: "時間規劃",
  intel: "情報頁",
  notify: "通知",
  external: "外部接口",
};

function graphData(overrides: Partial<WorksetPipelineGraphData> = {}): WorksetPipelineGraphData {
  return {
    worksets: taskCatalogState.worksets,
    tasks: taskCatalogState.tasks,
    items: [{ id: "item-1", title: "Milk", worksetId: "ws-1" }],
    sources: [{ id: "src-1", name: "News" }],
    channels: [{ channelId: "telegram:42", sourceId: "src-1" }],
    events: [],
    labels,
    assistantDefaultWorksetId: "__general__",
    reload: vi.fn(),
    ...overrides,
  };
}

function ModalAt({
  point,
  data,
}: {
  point: PipelinePoint | null;
  data: WorksetPipelineGraphData;
}) {
  return createElement(
    MemoryRouter,
    { initialEntries: ["/worksets?tab=graph"] },
    createElement(WorksetGraphPointModal, { point, data, onClose: vi.fn() }),
  );
}

describe("WorksetGraphPointModal", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = createTestHarness();
    resetTaskCatalogState();
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
        externalEnabled: false,
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
        includeInTimeline: true,
        notifyPref: "inherit",
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

  function dialog() {
    return document.body.querySelector('[data-testid="workset-graph-point-modal"]');
  }

  it("does not render when no point is open", async () => {
    await harness.render(ModalAt, { point: null, data: graphData() });
    expect(dialog()).toBeNull();
  });

  it("edits workset notify/external gates", async () => {
    await harness.render(ModalAt, {
      point: {
        id: "workset:ws-1",
        kind: "workset",
        entityId: "ws-1",
        label: "Ops",
        href: "/worksets/ws-1",
      },
      data: graphData(),
    });
    expect(dialog()?.querySelector('[data-testid="workset-notify-toggle-ws-1"]')).toBeTruthy();
    expect(dialog()?.querySelector('[data-testid="workset-external-toggle-ws-1"]')).toBeTruthy();
    expect(dialog()?.querySelector('[data-testid="workset-graph-open-page"]')).toBeTruthy();
  });

  it("shows task output switches", async () => {
    await harness.render(ModalAt, {
      point: {
        id: "task:t1",
        kind: "task",
        entityId: "t1",
        label: "Scan",
        href: "/tasks/t1/edit",
      },
      data: graphData(),
    });
    expect(dialog()?.querySelector('[data-testid="workset-graph-task-intel"]')).toBeTruthy();
    expect(dialog()?.querySelector('[data-testid="workset-graph-task-notify"]')).toBeTruthy();
    expect(dialog()?.querySelector('[data-testid="workset-graph-task-calendar"]')).toBeNull();
    expect(dialog()?.querySelector('[data-testid="workset-graph-open-page"]')).toBeTruthy();
  });

  it("keeps the calendar-write toggle in gear for agent tasks", async () => {
    taskCatalogState.tasks = [
      makeAnalysisTask({
        id: "agent-1",
        name: "Reconcile",
        analysisMode: "agent",
        worksetId: "ws-1",
        outputAnalysisEvents: true,
        includeInTimeline: true,
        outputCalendar: false,
        notifyPref: "inherit",
      }),
    ];
    await harness.render(ModalAt, {
      point: {
        id: "task:agent-1",
        kind: "task",
        entityId: "agent-1",
        label: "Reconcile",
        href: "/tasks/agent-1/agent",
      },
      data: graphData(),
    });
    expect(dialog()?.querySelector('[data-testid="workset-graph-task-calendar"]')).toBeTruthy();
    expect(dialog()?.querySelector('[data-testid="workset-graph-task-timeline"]')).toBeTruthy();
  });

  it("hides intelligence toggle for leaderboard tasks", async () => {
    taskCatalogState.tasks = [
      makeAnalysisTask({
        id: "lb-1",
        name: "Board",
        analysisMode: "leaderboard",
        worksetId: "ws-1",
        outputAnalysisEvents: true,
        notifyPref: "inherit",
      }),
    ];
    await harness.render(ModalAt, {
      point: {
        id: "task:lb-1",
        kind: "task",
        entityId: "lb-1",
        label: "Board",
        href: "/tasks/lb-1/edit",
      },
      data: graphData(),
    });
    expect(dialog()?.querySelector('[data-testid="workset-graph-task-intel"]')).toBeNull();
    expect(dialog()?.querySelector('[data-testid="workset-graph-task-calendar"]')).toBeNull();
    expect(dialog()?.querySelector('[data-testid="workset-graph-task-notify"]')).toBeTruthy();
  });

  it("only offers open-page for points without relationship switches", async () => {
    await harness.render(ModalAt, {
      point: {
        id: "page:assistant",
        kind: "page",
        entityId: "page:assistant",
        label: "助手",
        href: "/assistant",
      },
      data: graphData(),
    });
    expect(dialog()?.querySelector('[data-testid="workset-graph-open-page"]')).toBeTruthy();
    expect(dialog()?.querySelector('[data-testid="workset-graph-task-calendar"]')).toBeNull();
    expect(dialog()?.querySelector('[data-testid="workset-notify-toggle-ws-1"]')).toBeNull();
  });
});
