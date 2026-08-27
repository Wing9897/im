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
  mockCreateRecurringTimelineEvent,
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
  mockCreateRecurringTimelineEvent: vi.fn(),
  mockDismissTimelineEvent: vi.fn(),
  mockRefreshEvents: vi.fn(),
  mockRestoreTimelineEvent: vi.fn(),
  mockSetSelectedEvent: vi.fn(),
  mockShowToast: vi.fn(),
  mockUpdateUserEvent: vi.fn(),
  mockUseTimelinePageContainer: vi.fn(),
}));

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("react-router-dom", async () => {
  const { createElement } = await import("react");
  return {
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    Link: ({ to, children, ...rest }: { to: string; children?: ReactNode }) =>
      createElement("a", { href: typeof to === "string" ? to : "", ...rest }, children),
  };
});

vi.mock("../../api/userEvents", () => ({
  createUserEvent: (...args: unknown[]) => mockCreateUserEvent(...args),
  updateUserEvent: (...args: unknown[]) => mockUpdateUserEvent(...args),
}));

vi.mock("../../domain/timeline/createRecurringTimelineEvent", () => ({
  createRecurringTimelineEvent: (...args: unknown[]) =>
    mockCreateRecurringTimelineEvent(...args),
}));

vi.mock("../../api/timelineDismissals", () => ({
  dismissTimelineEvent: (...args: unknown[]) => mockDismissTimelineEvent(...args),
  restoreTimelineEvent: (...args: unknown[]) => mockRestoreTimelineEvent(...args),
  timelineItemDismissalSource: (source: string | undefined) => {
    if (source === "user") return "user";
    if (source === "recurring") return "recurring";
    if (source === "item_remind") return "item_remind";
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

vi.mock("../../hooks/useMonthWeather", () => ({
  useMonthWeather: () => ({
    weatherByDate: {},
    error: null,
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("../../hooks/useMonthHolidays", () => ({
  useMonthHolidays: () => ({
    holidaysByDate: {},
    error: null,
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("../../components/ui", () => ({
  AppPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PillButton: ({
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
  kind: "one_off",
  calendarKind: "normal",
  title: "Manual event",
  startTime: "2026-07-20T10:00:00Z",
  endTime: "",
  location: "Office",
  body: "Notes",
  worksetId: "__general__",
  isAllDay: false,
  remindBeforeDays: "",
  itemId: "",
  amountInput: "",
  direction: "expense",
  rrule: "",
  eventStartTime: "",
  eventEndTime: "",
  notifyPref: "inherit",
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
      goToDay: vi.fn(),
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
    mockSearchParams = new URLSearchParams();
    mockNavigate.mockReset();
    mockSetSearchParams.mockReset();
    mockCreateUserEvent.mockReset().mockResolvedValue({});
    mockCreateRecurringTimelineEvent.mockReset().mockResolvedValue({ id: "rec-1" });
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
      remindBeforeDays: null,
      itemId: null,
      kind: "normal",
      worksetId: "__general__",
      notifyPref: "inherit",
    });
    expect(mockCreateRecurringTimelineEvent).not.toHaveBeenCalled();
    expect(mockRefreshEvents).toHaveBeenCalledTimes(1);
  });

  it("creates a recurring event via the recurring-series API path", async () => {
    await renderPage();
    await flushAction(() => captures.addEvent!());
    const dialog = captures.dialog as CapturedDialog;

    await flushAction(() =>
      dialog.onSubmit({
        kind: "recurring",
        title: "Weekly standup",
        startTime: "",
        endTime: "",
        location: "Zoom",
        body: "Sync",
        worksetId: "__general__",
        isAllDay: false,
        remindBeforeDays: "",
        itemId: "",
        rrule: "FREQ=WEEKLY;BYDAY=MO",
        eventStartTime: "09:00",
        eventEndTime: "09:30",
        notifyPref: "inherit",
      }),
    );

    expect(mockCreateRecurringTimelineEvent).toHaveBeenCalledWith({
      title: "Weekly standup",
      worksetId: "__general__",
      isAllDay: false,
      eventStartTime: "09:00",
      eventEndTime: "09:30",
      location: "Zoom",
      body: "Sync",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      itemId: null,
      notifyPref: "inherit",
    });
    expect(mockCreateUserEvent).not.toHaveBeenCalled();
    expect(mockRefreshEvents).toHaveBeenCalledWith();
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringMatching(/週期|周期|Recurring/i),
      "success",
    );
  });

  it("toasts when create fails instead of closing silently", async () => {
    mockCreateUserEvent.mockRejectedValue(new Error("CHECK constraint failed"));
    await renderPage();
    await flushAction(() => captures.addEvent!());
    const dialog = captures.dialog as CapturedDialog;
    await flushAction(() => dialog.onSubmit(formValues));
    expect(mockShowToast).toHaveBeenCalledWith("CHECK constraint failed", "error");
    expect(mockRefreshEvents).not.toHaveBeenCalled();
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
