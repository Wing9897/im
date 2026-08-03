import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisEvent } from "../types";
import { emitResourceModified } from "../domain/sse/resourceModified";
import { ANALYSIS_EVENTS_MODES } from "../domain/tasks/analysisModeCapabilities";
import { useBoardTimedEventsWidget } from "./useBoardTimedEventsWidget";

const mocks = vi.hoisted(() => ({
  filterBySource: vi.fn((events: Array<{ id: string }>) =>
    events.filter((event) => event.id === "user-event"),
  ),
  setSelection: vi.fn(),
  refresh: vi.fn(),
  headerActions: vi.fn(),
  catalogOptions: vi.fn(() => [{ id: "catalog-option", name: "Catalog option" }]),
  resolveNames: vi.fn((events: Array<Record<string, unknown>>) =>
    events.map((event) =>
      event.source === "user" ? { ...event, taskName: "Resolved task" } : event,
    ),
  ),
  poll: vi.fn(),
  refreshOnAnalysis: vi.fn(),
}));

vi.mock("../components/SourceFilterDialog", () => ({
  SourceFilterDialog: () => null,
}));

vi.mock("../domain/timeline/sourceFilterOptions", () => ({
  catalogOrEventSourceOptions: mocks.catalogOptions,
}));

vi.mock("../domain/timeline/timedEventMerge", () => ({
  withResolvedUserEventTaskNames: mocks.resolveNames,
}));

vi.mock("../domain/timeline/useGeneralWorksetLabel", () => ({
  useGeneralWorksetLabel: () => "一般",
}));

vi.mock("../context/TaskCatalogContext", () => ({
  useTaskCatalog: () => ({
    tasks: [{ id: "task-1", name: "Task one", worksetId: "ws-1" }],
    worksets: [
      { id: "__user__", name: "General", isSystem: true },
      { id: "ws-1", name: "Workspace", isSystem: false },
    ],
  }),
  useTaskNameById: () => new Map([["task-1", "Task one"]]),
  useWorksetNameById: () => new Map([["ws-1", "Workspace"]]),
}));

vi.mock("./BoardWidgetFrame", () => ({
  useBoardWidgetHeaderActions: mocks.headerActions,
}));

vi.mock("./useBoardSourceFilter", () => ({
  useBoardSourceFilter: () => ({
    selection: { taskIds: ["task-1"], worksetIds: [] },
    setSelection: mocks.setSelection,
    filterBySource: mocks.filterBySource,
  }),
}));

vi.mock("./useBoardWidgetPoll", () => ({
  useBoardWidgetPoll: mocks.poll,
}));

vi.mock("../hooks/useRefreshOnAnalysisEvent", () => ({
  useRefreshOnAnalysisEvent: (...args: unknown[]) => mocks.refreshOnAnalysis(...args),
}));

const fetchedEvents = [
  {
    id: "user-event",
    source: "user",
    taskId: "task-1",
    worksetId: "ws-1",
    taskName: "task-1",
  },
  {
    id: "analysis-event",
    source: "analysis",
    taskId: "task-2",
  },
] as AnalysisEvent[];

function Probe() {
  const result = useBoardTimedEventsWidget({
    widgetId: "widget-1",
    active: false,
    fetcher: async () => fetchedEvents,
    pollMs: 123,
    ariaLabelPrefix: "Events",
    headerExtra: createElement("span", { "data-testid": "extra" }),
  });
  return createElement("div", {
    "data-events": result.events?.map((event) => `${event.id}:${event.taskName}`).join(",") ?? "",
    "data-filtered": result.filteredEvents.map((event) => event.id).join(","),
    "data-loading": String(result.loading),
    "data-error": result.error ?? "",
  });
}

describe("useBoardTimedEventsWidget", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.poll.mockReturnValue({
      data: fetchedEvents,
      error: null,
      loading: false,
      refresh: mocks.refresh,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("resolves names, filters events, and wires shared header options", () => {
    act(() => root.render(createElement(Probe)));

    const probe = container.firstElementChild;
    expect(probe?.getAttribute("data-events")).toBe(
      "user-event:Resolved task,analysis-event:undefined",
    );
    expect(probe?.getAttribute("data-filtered")).toBe("user-event");
    expect(mocks.poll).toHaveBeenCalledWith(expect.any(Function), 123, { active: false });
    expect(mocks.resolveNames).toHaveBeenCalledWith(
      fetchedEvents,
      expect.any(Map),
      "一般",
      expect.any(Map),
    );

    const header = mocks.headerActions.mock.lastCall?.[0] as ReactElement<{
      children: ReactNode;
    }>;
    expect(isValidElement(header)).toBe(true);
    const children = Children.toArray(header.props.children);
    const filter = children[0] as ReactElement<Record<string, unknown>>;
    expect(filter.props).toMatchObject({
      tasks: [{ id: "catalog-option", name: "Catalog option" }],
      worksets: [
        { id: "__user__", name: "一般", isSystem: true },
        { id: "ws-1", name: "Workspace", isSystem: false },
      ],
      expandTasks: [{ id: "task-1", name: "Task one", worksetId: "ws-1" }],
      ariaLabelPrefix: "Events",
      variant: "board",
    });
    expect(children).toHaveLength(2);
  });

  it("refreshes timed calendar data after an import mutation", () => {
    act(() => root.render(createElement(Probe)));

    act(() => {
      emitResourceModified({
        resourceType: "user_event",
        resourceId: "imported-1",
        action: "created",
      });
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("subscribes to analysis SSE for event + web_intel finding modes", () => {
    act(() => root.render(createElement(Probe)));

    expect(mocks.refreshOnAnalysis).toHaveBeenCalledWith(
      mocks.refresh,
      expect.objectContaining({ analysisMode: ANALYSIS_EVENTS_MODES }),
    );
    expect(ANALYSIS_EVENTS_MODES).toEqual(["event", "web_intel"]);
  });

  it("refreshes when trackable items / categories change via SSE", () => {
    act(() => root.render(createElement(Probe)));
    mocks.refresh.mockClear();

    act(() => {
      emitResourceModified({
        resourceType: "item",
        resourceId: "item-1",
        action: "updated",
      });
    });
    act(() => {
      emitResourceModified({
        resourceType: "item_category",
        resourceId: "seed_food",
        action: "updated",
      });
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });
});
