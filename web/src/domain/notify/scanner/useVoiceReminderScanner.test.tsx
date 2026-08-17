import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { mockShowToast, resetTaskCatalogState, taskCatalogState } from "../../../test/context-mocks";
import { loadRecentInbox, resetRecentInboxForTests } from "../recentInbox";

const {
  mockAnnounce,
  mockFetchTimelineEvents,
  mockFetchCalendarOccurrences,
  mockListUserEvents,
  mockListRecurringSeries,
  mockLoadSettings,
  mockAppendTrigger,
  mockSaveFiredKeys,
  mockClaimFiredKeys,
  mockShowFlash,
} = vi.hoisted(() => ({
  mockAnnounce: vi.fn().mockResolvedValue(undefined),
  mockFetchTimelineEvents: vi.fn(),
  mockFetchCalendarOccurrences: vi.fn(),
  mockListUserEvents: vi.fn(),
  mockListRecurringSeries: vi.fn(),
  mockLoadSettings: vi.fn(),
  mockAppendTrigger: vi.fn().mockResolvedValue({ entry: {}, persisted: true }),
  mockSaveFiredKeys: vi.fn().mockResolvedValue(true),
  mockClaimFiredKeys: vi.fn(async (keys: string[]) => new Set(keys)),
  mockShowFlash: vi.fn(),
}));

vi.mock("../../../api/results", () => ({
  fetchTimelineEvents: (...args: unknown[]) => mockFetchTimelineEvents(...args),
  fetchCalendarOccurrences: (...args: unknown[]) =>
    mockFetchCalendarOccurrences(...args),
}));

vi.mock("../../../api/userEvents", () => ({
  listUserEventsPage: (...args: unknown[]) =>
    Promise.resolve(mockListUserEvents(...args)).then((items) => ({
      items: items ?? [],
      nextCursor: null,
    })),
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
    loadVoiceReminderSettings: () => mockLoadSettings(),
    hydrateVoiceReminderSettings: () => Promise.resolve(mockLoadSettings()),
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

describe("useVoiceReminderScanner notify resolve", () => {
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
    mockFetchTimelineEvents.mockResolvedValue([
      {
        id: "page-1",
        taskId: "task-1",
        taskName: "Tracked task",
        title: "First paged event",
        startTime: "2026-07-20T10:00:00.000Z",
      },
    ]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "manual-1",
        title: "Manual event included",
        startTime: "2026-07-20T10:00:00.000Z",
        worksetId: SYSTEM_WORKSET_ID,
        notifyPref: "follow",
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
    resetRecentInboxForTests();
    vi.restoreAllMocks();
  });

  it("fetches all sources including items and announces follow-default rows", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockFetchTimelineEvents).toHaveBeenCalledWith({
      startDate: "2026-07-20T08:59:00.000Z",
      endDate: "2026-07-20T10:05:00.000Z",
    });
    expect(mockFetchCalendarOccurrences).toHaveBeenCalledWith(
      "2026-07-20T08:59:00.000Z",
      "2026-07-20T10:05:00.000Z",
    );
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

    expect(mockFetchTimelineEvents).not.toHaveBeenCalled();
    expect(mockListUserEvents).not.toHaveBeenCalled();
    expect(mockFetchCalendarOccurrences).not.toHaveBeenCalled();
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
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "muted-1",
        title: "Follow muted workset",
        startTime: "2026-07-20T10:00:00.000Z",
        worksetId: SYSTEM_WORKSET_ID,
        notifyPref: "follow",
      },
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
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([]);

    await act(async () => {
      root = createRoot(container);
      root.render(<Harness />);
      await flushScan();
    });

    expect(mockFetchTimelineEvents).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
  });

  it("includes item_remind calendar rows when includeItems is open", async () => {
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([]);
    mockFetchCalendarOccurrences.mockResolvedValue([
      {
        id: "item:i1:remind",
        seriesId: "",
        title: "Passport remind",
        startTime: "2026-07-20T10:00:00.000Z",
        source: "item_remind",
        worksetId: SYSTEM_WORKSET_ID,
        notifyPref: "follow",
      },
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
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([]);
    mockFetchCalendarOccurrences.mockResolvedValue([
      {
        id: "item:i2:remind",
        seriesId: "",
        title: "Muted passport remind",
        startTime: "2026-07-20T10:00:00.000Z",
        source: "item_remind",
        worksetId: SYSTEM_WORKSET_ID,
        notifyPref: "off",
      },
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
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "voice-only",
        title: "Voice only",
        startTime: "2026-07-20T10:00:00.000Z",
        worksetId: SYSTEM_WORKSET_ID,
        notifyPref: "follow",
      },
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
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "flash-only",
        title: "Flash only",
        startTime: "2026-07-20T10:00:00.000Z",
        worksetId: SYSTEM_WORKSET_ID,
        notifyPref: "follow",
      },
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
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "flash-persist",
        title: "Persistent flash",
        startTime: "2026-07-20T10:00:00.000Z",
        worksetId: SYSTEM_WORKSET_ID,
        notifyPref: "follow",
      },
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
    mockFetchTimelineEvents.mockResolvedValue([]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "inbox-only",
        title: "Inbox only",
        startTime: "2026-07-20T10:00:00.000Z",
        worksetId: SYSTEM_WORKSET_ID,
        notifyPref: "follow",
      },
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

    expect(mockFetchTimelineEvents).not.toHaveBeenCalled();
    expect(mockAnnounce).not.toHaveBeenCalled();
    expect(mockShowFlash).not.toHaveBeenCalled();
    expect(loadRecentInbox()).toEqual([]);
  });
});
