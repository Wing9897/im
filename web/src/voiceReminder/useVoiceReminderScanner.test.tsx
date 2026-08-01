import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_WORKSET_ID } from "../types/worksets";

const {
  mockAnnounce,
  mockFetchTimelineEvents,
  mockFetchCalendarOccurrences,
  mockListUserEvents,
  mockLoadSettings,
  mockAppendTrigger,
  mockSaveFiredKeys,
  mockClaimFiredKeys,
} = vi.hoisted(() => ({
  mockAnnounce: vi.fn().mockResolvedValue(undefined),
  mockFetchTimelineEvents: vi.fn(),
  mockFetchCalendarOccurrences: vi.fn(),
  mockListUserEvents: vi.fn(),
  mockLoadSettings: vi.fn(),
  mockAppendTrigger: vi.fn().mockResolvedValue({ entry: {}, persisted: true }),
  mockSaveFiredKeys: vi.fn().mockResolvedValue(true),
  mockClaimFiredKeys: vi.fn(async (keys: string[]) => new Set(keys)),
}));

vi.mock("../api/results", () => ({
  fetchTimelineEvents: (...args: unknown[]) => mockFetchTimelineEvents(...args),
  fetchCalendarOccurrences: (...args: unknown[]) =>
    mockFetchCalendarOccurrences(...args),
}));

vi.mock("../api/userEvents", () => ({
  listUserEvents: (...args: unknown[]) => mockListUserEvents(...args),
}));

vi.mock("../api/tasks", () => ({
  listTasks: vi.fn(async () => []),
}));

vi.mock("../context/TaskCatalogContext", async () =>
  (await import("../test/context-mocks")).taskCatalogModuleMock());

vi.mock("./settings", () => ({
  VOICE_REMINDER_SETTINGS_CHANGED_EVENT: "im:voice-reminder-settings-changed",
  loadVoiceReminderSettings: () => mockLoadSettings(),
  hydrateVoiceReminderSettings: () => Promise.resolve(mockLoadSettings()),
}));

vi.mock("../speech", () => ({
  createSpeechPorts: () => ({
    tts: { isAvailable: () => true },
  }),
  loadVoiceSettings: () => ({ speechLanguage: "zh-TW" }),
  ttsSpeakOptionsFromVoiceSettings: () => ({}),
}));

vi.mock("./announce", () => ({
  announceVoiceReminder: (...args: unknown[]) => mockAnnounce(...args),
}));

vi.mock("./triggerHistory", () => ({
  appendVoiceReminderTrigger: (...args: unknown[]) => mockAppendTrigger(...args),
  buildVoiceReminderTriggerReason: (title: string) => title,
  hydrateVoiceReminderHistory: () => Promise.resolve([]),
}));

vi.mock("./scanner", async () => {
  const actual = await vi.importActual<typeof import("./scanner")>("./scanner");
  return {
    ...actual,
    hydrateFiredKeys: () => Promise.resolve(new Set()),
    loadFiredKeys: () => new Set(),
    saveFiredKeys: (...args: unknown[]) => mockSaveFiredKeys(...args),
    claimFiredKeys: (...args: unknown[]) => mockClaimFiredKeys(...args),
  };
});

import { useVoiceReminderScanner } from "./useVoiceReminderScanner";

function Harness() {
  useVoiceReminderScanner();
  return null;
}

describe("useVoiceReminderScanner pagination consumer", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-07-20T09:00:00.000Z"));
    mockAnnounce.mockReset().mockResolvedValue(undefined);
    mockAppendTrigger.mockReset().mockResolvedValue({ entry: {}, persisted: true });
    mockSaveFiredKeys.mockReset().mockResolvedValue(true);
    mockClaimFiredKeys.mockReset().mockImplementation(async (keys: string[]) => new Set(keys));
    mockLoadSettings.mockReturnValue({
      enabled: true,
      leadOffsetsMinutes: [60],
      sourceFilter: { taskIds: ["task-1"], worksetIds: [] },
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });
    mockFetchTimelineEvents.mockResolvedValue([
      {
        id: "page-1",
        taskId: "task-1",
        taskName: "Tracked task",
        title: "First paged event",
        startTime: "2026-07-20T10:00:00.000Z",
      },
      {
        id: "page-2",
        taskId: "task-1",
        taskName: "Tracked task",
        title: "Second paged event",
        startTime: "2026-07-20T10:00:00.000Z",
      },
    ]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "manual-1",
        title: "Manual event must be excluded",
        startTime: "2026-07-20T10:00:00.000Z",
      },
    ]);
    mockFetchCalendarOccurrences.mockResolvedValue([]);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it("scans during disabled quiet hours and excludes unselected user events", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchTimelineEvents).toHaveBeenCalledWith({
      startDate: "2026-07-20T08:59:00.000Z",
      endDate: "2026-07-20T10:05:00.000Z",
      taskIds: ["task-1"],
    });
    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      "2026-07-20T08:59:00.000Z",
      "2026-07-20T10:05:00.000Z",
      { taskIds: ["task-1"] },
    );
    expect(mockAnnounce).toHaveBeenCalledTimes(2);
    expect(mockAnnounce.mock.calls.map((call) => String(call[1]))).toEqual([
      expect.stringContaining("First paged event"),
      expect.stringContaining("Second paged event"),
    ]);
    expect(mockAnnounce.mock.calls.flat().join(" ")).not.toContain(
      "Manual event must be excluded",
    );
  });

  it("does not fetch events while enabled quiet hours are active", async () => {
    const now = new Date(Date.now());
    const start = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const end = `${String((now.getHours() + 1) % 24).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    mockLoadSettings.mockReturnValue({
      enabled: true,
      leadOffsetsMinutes: [60],
      sourceFilter: null,
      preambleChimeId: "none",
      quietHours: { enabled: true, start, end },
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(mockFetchTimelineEvents).not.toHaveBeenCalled();
    expect(mockListUserEvents).not.toHaveBeenCalled();
    expect(mockFetchCalendarOccurrences).not.toHaveBeenCalled();
  });

  it("includes calendar RRULE occurrences when their task is selected", async () => {
    mockLoadSettings.mockReturnValue({
      enabled: true,
      leadOffsetsMinutes: [60],
      sourceFilter: { taskIds: ["cal-task"], worksetIds: [] },
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([]);
    mockFetchCalendarOccurrences.mockResolvedValue([
      {
        id: "occ-1",
        taskId: "cal-task",
        taskName: "週會",
        title: "站立會議",
        startTime: "2026-07-20T10:00:00.000Z",
        endTime: "2026-07-20T10:30:00.000Z",
        isAllDay: false,
        location: null,
        description: null,
        rrule: "FREQ=DAILY",
      },
    ]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      "2026-07-20T08:59:00.000Z",
      "2026-07-20T10:05:00.000Z",
      { taskIds: ["cal-task"] },
    );
    expect(mockAnnounce).toHaveBeenCalledTimes(1);
    expect(String(mockAnnounce.mock.calls[0]?.[1])).toContain("站立會議");
    expect(String(mockAnnounce.mock.calls[0]?.[1])).toContain("循環任務");
  });

  it("includes manual and assistant events when their reminder source is selected", async () => {
    mockLoadSettings.mockReturnValue({
      enabled: true,
      leadOffsetsMinutes: [60],
      sourceFilter: { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] },
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "manual-1",
        title: "Manual event must be included",
        startTime: "2026-07-20T10:00:00.000Z",
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
      },
      {
        id: "assistant-1",
        title: "Assistant event must be included",
        startTime: "2026-07-20T10:00:00.000Z",
        taskId: "",
        worksetId: SYSTEM_WORKSET_ID,
      },
      {
        id: "tagged-1",
        title: "Tagged event must be excluded from __user__",
        startTime: "2026-07-20T10:00:00.000Z",
        taskId: "ct-1",
        worksetId: "ws-other",
      },
    ]);
    mockFetchCalendarOccurrences.mockResolvedValue([]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockAnnounce).toHaveBeenCalledTimes(2);
    expect(mockAnnounce.mock.calls.map((call) => String(call[1]))).toEqual([
      expect.stringContaining("Assistant event must be included"),
      expect.stringContaining("Manual event must be included"),
    ]);
    expect(mockAnnounce.mock.calls.flat().join(" ")).not.toContain(
      "Tagged event must be excluded from __user__",
    );
    expect(mockFetchTimelineEvents).toHaveBeenCalledWith({
      startDate: "2026-07-20T08:59:00.000Z",
      endDate: "2026-07-20T10:05:00.000Z",
      taskIds: [],
    });
    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      "2026-07-20T08:59:00.000Z",
      "2026-07-20T10:05:00.000Z",
      { taskIds: [] },
    );
  });

  it("includes user events tagged to a selected task id", async () => {
    mockLoadSettings.mockReturnValue({
      enabled: true,
      leadOffsetsMinutes: [60],
      sourceFilter: { taskIds: ["ct-1"], worksetIds: [] },
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "tagged-1",
        title: "Calendar-task-tagged reminder",
        startTime: "2026-07-20T10:00:00.000Z",
        taskId: "ct-1",
      },
      {
        id: "unassigned-1",
        title: "Unassigned must be excluded",
        startTime: "2026-07-20T10:00:00.000Z",
        taskId: "",
      },
    ]);
    mockFetchCalendarOccurrences.mockResolvedValue([]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockAnnounce).toHaveBeenCalledTimes(1);
    expect(String(mockAnnounce.mock.calls[0]?.[1])).toContain("Calendar-task-tagged reminder");
    expect(mockAnnounce.mock.calls.flat().join(" ")).not.toContain(
      "Unassigned must be excluded",
    );
  });
});
