import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarWindowItem } from "../../../api/calendarWindow";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { mockShowToast, resetTaskCatalogState, taskCatalogState } from "../../../test/context-mocks";
import { loadRecentInbox, resetRecentInboxForTests } from "../recentInbox";

function windowRow(
  overrides: Partial<CalendarWindowItem> & Pick<CalendarWindowItem, "id" | "source" | "title">,
): CalendarWindowItem {
  return {
    startTime: "2026-07-20T10:00:00.000Z",
    endTime: null,
    location: null,
    isAllDay: false,
    timezone: null,
    emoji: null,
    taskId: null,
    seriesId: null,
    worksetId: SYSTEM_WORKSET_ID,
    itemId: null,
    origin: null,
    itemDateKind: null,
    notifyPref: "inherit",
    dismissed: false,
    important: false,
    taskName: null,
    isLastOccurrence: false,
    remindBeforeDays: null,
    body: "",
    ...overrides,
  };
}

const {
  mockAnnounce,
  mockFetchCalendarWindow,
  mockListRecurringSeries,
  mockLoadSettings,
  mockAppendTrigger,
  mockSaveFiredKeys,
  mockClaimFiredKeys,
  mockShowFlash,
} = vi.hoisted(() => ({
  mockAnnounce: vi.fn().mockResolvedValue(undefined),
  mockFetchCalendarWindow: vi.fn(),
  mockListRecurringSeries: vi.fn(),
  mockLoadSettings: vi.fn(),
  mockAppendTrigger: vi.fn().mockResolvedValue({ entry: {}, persisted: true }),
  mockSaveFiredKeys: vi.fn().mockResolvedValue(true),
  mockClaimFiredKeys: vi.fn(async (keys: string[]) => new Set(keys)),
  mockShowFlash: vi.fn(),
}));

vi.mock("../../../api/calendarWindow", () => ({
  fetchCalendarWindow: (...args: unknown[]) => mockFetchCalendarWindow(...args),
}));

vi.mock("../../../api/recurringSeries", () => ({
  listRecurringSeries: (...args: unknown[]) => mockListRecurringSeries(...args),
}));

vi.mock("../../../api/tasks", () => ({
  listTasks: vi.fn(async () => []),
}));

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock());

vi.mock("./settings", async () => {
  const actual = await vi.importActual<typeof import("./settings")>("./settings");
  return {
    ...actual,
    loadNotifySettings: () => mockLoadSettings(),
    hydrateNotifySettings: () => Promise.resolve(mockLoadSettings()),
  };
});

vi.mock("../../../speech", () => ({
  createSpeechPorts: () => ({
    tts: { isAvailable: () => true },
  }),
  loadVoiceSettings: () => ({ speechLanguage: "zh-TW" }),
  ttsSpeakOptionsFromVoiceSettings: () => ({}),
}));

vi.mock("../notifyFlash", () => ({
  showNotifyFlash: (...args: unknown[]) => mockShowFlash(...args),
}));

vi.mock("./announce", () => ({
  announceNotify: (...args: unknown[]) => mockAnnounce(...args),
}));

vi.mock("./triggerHistory", () => ({
  appendNotifyTrigger: (...args: unknown[]) => mockAppendTrigger(...args),
  buildNotifyTriggerReason: (title: string) => title,
  hydrateNotifyHistory: () => Promise.resolve([]),
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

import { useNotifyScanner } from "./useNotifyScanner";

function Harness() {
  useNotifyScanner();
  return null;
}

async function flushScan() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useNotifyScanner notify resolve", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    resetRecentInboxForTests();
    resetTaskCatalogState();
    mockShowToast.mockReset();
    mockShowFlash.mockReset();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-07-20T09:00:00.000Z"));
    mockAnnounce.mockReset().mockResolvedValue(undefined);
    mockAppendTrigger.mockReset().mockResolvedValue({ entry: {}, persisted: true });
    mockSaveFiredKeys.mockReset().mockResolvedValue(true);
    mockClaimFiredKeys.mockReset().mockImplementation(async (keys: string[]) => new Set(keys));
    mockListRecurringSeries.mockResolvedValue({ items: [], totalCount: 0, hasMore: false });
    taskCatalogState.worksets = [
      {
        id: SYSTEM_WORKSET_ID,
        name: "General",
        isSystem: true,
        notifyEnabled: true,
        createdAt: null,
        updatedAt: null,
      },
    ];
    mockLoadSettings.mockReturnValue({
      enabled: true,
      voiceEnabled: true,
      flashEnabled: true,
      leadOffsetsMinutes: [60],
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });
    mockFetchCalendarWindow.mockResolvedValue([
      windowRow({
        id: "page-1",
        source: "analysis",
        taskId: "task-1",
        taskName: "Tracked task",
        title: "First paged event",
      }),
      windowRow({
        id: "manual-1",
        source: "user",
        title: "Manual event included",
      }),
    ]);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
    resetRecentInboxForTests();
    vi.restoreAllMocks();
  });

  it("fetches all sources including items and announces follow-default rows", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockFetchCalendarWindow).toHaveBeenCalledWith({
      start: "2026-07-20T08:59:00.000Z",
      end: "2026-07-20T10:05:00.000Z",
      includeAnalysis: true,
      includeUser: true,
      includeRecurring: true,
      includeItems: true,
    });
    expect(mockAnnounce).toHaveBeenCalledTimes(2);
    expect(mockShowFlash).toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockAnnounce.mock.calls.flat().join(" ")).toContain("First paged event");
    expect(mockAnnounce.mock.calls.flat().join(" ")).toContain("Manual event included");
  });

  it("does not fetch events while enabled quiet hours are active", async () => {
    const now = new Date(Date.now());
    const start = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const end = `${String((now.getHours() + 1) % 24).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    mockLoadSettings.mockReturnValue({
      enabled: true,
      voiceEnabled: true,
      flashEnabled: true,
      leadOffsetsMinutes: [60],
      preambleChimeId: "none",
      quietHours: { enabled: true, start, end },
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(mockFetchCalendarWindow).not.toHaveBeenCalled();
  });

  it("mutes a workset follow-default", async () => {
    taskCatalogState.worksets = [
      {
        id: SYSTEM_WORKSET_ID,
        name: "General",
        isSystem: true,
        notifyEnabled: false,
        createdAt: null,
        updatedAt: null,
      },
    ];
    mockFetchCalendarWindow.mockResolvedValue([
      windowRow({
        id: "muted-1",
        source: "user",
        title: "Follow muted workset",
      }),
    ]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockAnnounce).not.toHaveBeenCalled();
  });

  it("skips scanning until workset and task catalogs have loaded", async () => {
    taskCatalogState.worksetsLoading = true;
    taskCatalogState.tasksLoading = true;
    mockFetchCalendarWindow.mockResolvedValue([]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockFetchCalendarWindow).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
  });

  it("includes item_remind calendar rows when includeItems is open", async () => {
    mockFetchCalendarWindow.mockResolvedValue([
      windowRow({
        id: "item:i1:remind",
        source: "item_remind",
        title: "Passport remind",
        itemDateKind: "remind",
      }),
    ]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockAnnounce).toHaveBeenCalledTimes(1);
    expect(String(mockAnnounce.mock.calls[0]?.[1])).toContain("Passport remind");
  });

  it("mutes item_remind rows that inherit force-off from the linked calendar", async () => {
    mockFetchCalendarWindow.mockResolvedValue([
      windowRow({
        id: "item:i2:remind",
        source: "item_remind",
        title: "Muted passport remind",
        itemDateKind: "remind",
        notifyPref: "off",
      }),
    ]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockAnnounce).not.toHaveBeenCalled();
  });

  it("speaks without flashing when only voice is on", async () => {
    mockLoadSettings.mockReturnValue({
      enabled: true,
      voiceEnabled: true,
      flashEnabled: false,
      leadOffsetsMinutes: [60],
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });
    mockFetchCalendarWindow.mockResolvedValue([
      windowRow({
        id: "voice-only",
        source: "user",
        title: "Voice only",
      }),
    ]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockAnnounce).toHaveBeenCalledTimes(1);
    expect(mockShowFlash).not.toHaveBeenCalled();
    expect(loadRecentInbox()).toHaveLength(1);
  });

  it("flashes without speaking when only flash is on", async () => {
    mockLoadSettings.mockReturnValue({
      enabled: true,
      voiceEnabled: false,
      flashEnabled: true,
      leadOffsetsMinutes: [60],
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });
    mockFetchCalendarWindow.mockResolvedValue([
      windowRow({
        id: "flash-only",
        source: "user",
        title: "Flash only",
      }),
    ]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockShowFlash).toHaveBeenCalledTimes(1);
    expect(mockShowFlash).toHaveBeenCalledWith(expect.any(String), { persist: false });
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(loadRecentInbox()).toHaveLength(1);
  });

  it("passes persist when flash presentation is persistent", async () => {
    mockLoadSettings.mockReturnValue({
      enabled: true,
      voiceEnabled: false,
      flashEnabled: true,
      flashMode: "persistent",
      leadOffsetsMinutes: [60],
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });
    mockFetchCalendarWindow.mockResolvedValue([
      windowRow({
        id: "flash-persist",
        source: "user",
        title: "Persistent flash",
      }),
    ]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockShowFlash).toHaveBeenCalledWith(expect.any(String), { persist: true });
    expect(mockAnnounce).not.toHaveBeenCalled();
  });

  it("writes the last-day inbox when both channels are off", async () => {
    mockLoadSettings.mockReturnValue({
      enabled: true,
      voiceEnabled: false,
      flashEnabled: false,
      leadOffsetsMinutes: [60],
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });
    mockFetchCalendarWindow.mockResolvedValue([
      windowRow({
        id: "inbox-only",
        source: "user",
        title: "Inbox only",
      }),
    ]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockShowFlash).not.toHaveBeenCalled();
    expect(loadRecentInbox().map((row) => row.title)).toEqual(["Inbox only"]);
  });

  it("silences voice, flash, and inbox when the master switch is off", async () => {
    mockLoadSettings.mockReturnValue({
      enabled: false,
      voiceEnabled: true,
      flashEnabled: true,
      leadOffsetsMinutes: [60],
      preambleChimeId: "none",
      quietHours: { enabled: false, start: "00:00", end: "23:59" },
    });

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockFetchCalendarWindow).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockShowFlash).not.toHaveBeenCalled();
    expect(loadRecentInbox()).toEqual([]);
  });
});
