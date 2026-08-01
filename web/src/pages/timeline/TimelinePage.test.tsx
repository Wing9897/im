import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TimelineItem } from "../../types";
import type { UserEventFormValues } from "../../components/calendar/UserEventDialog";
import type { TimelinePageContextValue } from "./TimelinePageContext";
import { makeEvent } from "../../test/timelineTestHelpers";

const {
  captures,
  mockCreateUserEvent,
  mockDismissTimelineEvent,
  mockRefreshEvents,
  mockRestoreTimelineEvent,
  mockSetSelectedEvent,
  mockShowToast,
  mockUpdateUserEvent,
  mockUseTimelinePageContainer,
} = vi.hoisted(() => ({
  captures: {
    addEvent: null as (() => void) | null,
    context: null as unknown,
    dialog: null as unknown,
  },
  mockCreateUserEvent: vi.fn(),
  mockDismissTimelineEvent: vi.fn(),
  mockRefreshEvents: vi.fn(),
  mockRestoreTimelineEvent: vi.fn(),
  mockSetSelectedEvent: vi.fn(),
  mockShowToast: vi.fn(),
  mockUpdateUserEvent: vi.fn(),
  mockUseTimelinePageContainer: vi.fn(),
}));

vi.mock("../../api/userEvents", () => ({
  createUserEvent: (...args: unknown[]) => mockCreateUserEvent(...args),
  updateUserEvent: (...args: unknown[]) => mockUpdateUserEvent(...args),
}));

vi.mock("../../api/timelineDismissals", () => ({
  dismissTimelineEvent: (...args: unknown[]) => mockDismissTimelineEvent(...args),
  restoreTimelineEvent: (...args: unknown[]) => mockRestoreTimelineEvent(...args),
  timelineItemDismissalSource: (source: string | undefined) => {
    if (source === "user") return "user";
    if (source === "recurring") return "recurring";
    return "analysis";
  },
}));

vi.mock("../../context/ToastContext", async () => {
  const { createContext } = await import("react");
  return {
    ToastContext: createContext({ showToast: mockShowToast }),
    useToast: () => ({ showToast: mockShowToast }),
  };
});

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("./useTimelinePageContainer", () => ({
  useTimelinePageContainer: () => mockUseTimelinePageContainer(),
}));

vi.mock("../../components/ui", () => ({
  AppPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("./components/TimelineControlBar", () => ({
  TimelineControlBar: ({
    children,
    onAddEvent,
  }: {
    children: ReactNode;
    onAddEvent: () => void;
  }) => {
    captures.addEvent = onAddEvent;
    return <div>{children}</div>;
  },
}));

vi.mock("./components/TimelineShowOptionsControl", () => ({
  TimelineShowOptionsControl: () => null,
}));

vi.mock("./components/TimelineViewSwitch", () => ({
  TimelineViewSwitch: () => null,
}));

vi.mock("../../components/calendar/UserEventDialog", () => ({
  UserEventDialog: (props: unknown) => {
    captures.dialog = props;
    return null;
  },
}));

vi.mock("./TimelinePageContext", () => ({
  TimelinePageProvider: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: unknown;
  }) => {
    captures.context = value;
    return <>{children}</>;
  },
}));

import { TimelinePage } from "./TimelinePage";

interface CapturedDialog {
  open: boolean;
  mode: "create" | "edit";
  error: string | null;
  onSubmit: (values: UserEventFormValues) => void;
}

const formValues: UserEventFormValues = {
  title: "Manual event",
  startTime: "2026-07-20T10:00:00Z",
  endTime: "",
  location: "Office",
  body: "Notes",
  worksetId: "__user__",
  isAllDay: false,
};

function makeUserEvent(): TimelineItem {
  return makeEvent({
    id: "user-1",
    taskId: null,
    taskName: "用戶事件",
    title: "Existing event",
    source: "user",
    origin: "manual",
  });
}

function makeContainer(selectedEvent: TimelineItem | null = null) {
  return {
    sources: {
      selectedSources: null,
      setSelectedSources: vi.fn(),
      timelineTasks: [],
      viewMode: "calendar",
      setViewMode: vi.fn(),
      emptyState: "",
      eventStatuses: {},
      setEventStatus: vi.fn(),
      focusDay: vi.fn(),
    },
    data: {
      events: [],
      initialLoading: false,
      isRefreshing: false,
      pageError: null,
      refreshEvents: mockRefreshEvents,
      taskSpans: [],
      spansInitialLoading: false,
      spansIsRefreshing: false,
      spansError: null,
      fetchSpans: vi.fn(),
      timelineEvents: [],
      timelineEventsInitialLoading: false,
      timelineEventsIsRefreshing: false,
      timelineEventsError: null,
      retryTimelineEvents: vi.fn(),
    },
    navigation: {
      timeScale: "month",
      rangeStart: new Date("2026-07-01T00:00:00Z"),
      rangeEvents: [],
      weekDays: [],
      timeCursor: new Date("2026-07-01T00:00:00Z"),
      monthCursor: new Date("2026-07-01T00:00:00Z"),
      monthDays: [],
      monthEvents: [],
      ganttColumns: [],
      focusedDay: null,
      moveCursor: vi.fn(),
      jumpTo: vi.fn(),
      visibleRangeLabel: "July 2026",
    },
    filters: {
      showDismissed: false,
      setShowDismissed: vi.fn(),
      showOngoing: true,
      setShowOngoing: vi.fn(),
      showEnding: true,
      setShowEnding: vi.fn(),
      filteredEvents: [],
      sidebarEvents: [],
    },
    selection: {
      selectedEvent,
      setSelectedEvent: mockSetSelectedEvent,
      editStartTime: "",
      setEditStartTime: vi.fn(),
      editEndTime: "",
      setEditEndTime: vi.fn(),
      saveTimeOverride: vi.fn(),
      resetTimeOverride: vi.fn(),
    },
    gantt: {
      selectedGanttTaskId: null,
      handleSelectGanttTask: vi.fn(),
      selectedGanttSpan: null,
      setSelectedGanttTaskId: vi.fn(),
    },
  };
}

describe("TimelinePage user-event CRUD", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    captures.addEvent = null;
    captures.context = null;
    captures.dialog = null;
    mockCreateUserEvent.mockReset().mockResolvedValue({});
    mockDismissTimelineEvent.mockReset().mockResolvedValue({});
    mockRestoreTimelineEvent.mockReset().mockResolvedValue(undefined);
    mockUpdateUserEvent.mockReset().mockResolvedValue({});
    mockRefreshEvents.mockReset().mockResolvedValue(undefined);
    mockSetSelectedEvent.mockReset();
    mockShowToast.mockReset();
    mockUseTimelinePageContainer.mockReturnValue(makeContainer());
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderPage() {
    await act(async () => {
      root = createRoot(container);
      root.render(<TimelinePage />);
      await Promise.resolve();
    });
  }

  async function flushAction(action: () => void) {
    await act(async () => {
      action();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function confirmPendingDialog() {
    const dialog = document.body.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    const buttons = dialog!.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    await flushAction(() => {
      (buttons[1] as HTMLButtonElement).click();
    });
  }

  it("creates an event and refreshes the visible data", async () => {
    await renderPage();
    await flushAction(() => captures.addEvent!());
    const dialog = captures.dialog as CapturedDialog;
    expect(dialog.open).toBe(true);
    expect(dialog.mode).toBe("create");

    await flushAction(() => dialog.onSubmit(formValues));

    expect(mockCreateUserEvent).toHaveBeenCalledWith({
      title: "Manual event",
      startTime: "2026-07-20T10:00:00Z",
      endTime: null,
      body: "Notes",
      location: "Office",
      isAllDay: false,
      worksetId: "__user__",
    });
    expect(mockRefreshEvents).toHaveBeenCalledTimes(1);
  });

  it("edits an event and refreshes the visible data", async () => {
    const event = makeUserEvent();
    await renderPage();
    const context = captures.context as TimelinePageContextValue;
    await flushAction(() => context.onEditUserEvent!(event));
    const dialog = captures.dialog as CapturedDialog;
    expect(dialog.mode).toBe("edit");

    await flushAction(() => dialog.onSubmit({ ...formValues, title: "Updated" }));

    expect(mockUpdateUserEvent).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Updated" }),
    );
    expect(mockRefreshEvents).toHaveBeenCalledTimes(1);
  });

  it("dismisses the selected event, clears selection, and refreshes", async () => {
    const event = makeUserEvent();
    mockUseTimelinePageContainer.mockReturnValue(makeContainer(event));
    await renderPage();

    await flushAction(() => {
      const context = captures.context as TimelinePageContextValue;
      context.onDismissTimelineEvent!(event);
    });
    await confirmPendingDialog();

    expect(mockDismissTimelineEvent).toHaveBeenCalledWith("user", "user-1");
    expect(mockSetSelectedEvent).toHaveBeenCalledWith(null);
    expect(mockRefreshEvents).toHaveBeenCalledTimes(1);
  });

  it("shows dismiss failures instead of swallowing them", async () => {
    const event = makeUserEvent();
    mockDismissTimelineEvent.mockRejectedValue(new Error("Dismiss denied"));
    await renderPage();

    await flushAction(() => {
      const context = captures.context as TimelinePageContextValue;
      context.onDismissTimelineEvent!(event);
    });
    await confirmPendingDialog();

    expect(mockShowToast).toHaveBeenCalledWith("Dismiss denied", "error");
    expect(mockRefreshEvents).not.toHaveBeenCalled();
  });

  it("restores a dismissed event and refreshes", async () => {
    const event = { ...makeUserEvent(), dismissed: true };
    mockUseTimelinePageContainer.mockReturnValue(makeContainer(event));
    await renderPage();

    await flushAction(() => {
      const context = captures.context as TimelinePageContextValue;
      context.onRestoreTimelineEvent!(event);
    });
    await confirmPendingDialog();

    expect(mockRestoreTimelineEvent).toHaveBeenCalledWith("user", "user-1");
    expect(mockRefreshEvents).toHaveBeenCalledTimes(1);
  });
});
