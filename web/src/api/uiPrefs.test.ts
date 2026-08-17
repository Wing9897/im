/**
 * Unit tests for `/api/v1/ui-prefs/*` client helpers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  fetchBoardPrefs,
  fetchVoiceReminderFired,
  fetchVoiceReminderHistory,
  fetchVoiceReminderSettings,
  putBoardPrefs,
  putVoiceReminderFired,
  putVoiceReminderHistory,
  putVoiceReminderSettings,
  claimVoiceReminderFired,
} from "./uiPrefs";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

describe("uiPrefs board API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchBoardPrefs GETs /api/v1/ui-prefs/board", async () => {
    const payload = { configured: false, layout: null, widgetState: null };
    vi.mocked(apiClient.get).mockResolvedValue(payload);
    await expect(fetchBoardPrefs()).resolves.toEqual(payload);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/ui-prefs/board");
  });

  it("putBoardPrefs PUTs body to /api/v1/ui-prefs/board", async () => {
    const body = {
      layout: { version: 14, widgets: [] },
      widgetState: { mapViews: {}, sourceFilters: {}, ganttViewModes: {} },
    };
    const response = { configured: true, ...body };
    vi.mocked(apiClient.put).mockResolvedValue(response);
    await expect(putBoardPrefs(body)).resolves.toEqual(response);
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/ui-prefs/board", body);
  });
});

describe("uiPrefs local notify API", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.put).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("fetches and puts settings", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ configured: false, settings: null });
    await fetchVoiceReminderSettings();
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/ui-prefs/notify/settings");

    const settings = {
      enabled: true,
      voiceEnabled: true,
      flashEnabled: true,
      flashMode: "timed" as const,
      leadOffsetsMinutes: [60],
      preambleChimeId: "broadcast",
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    };
    vi.mocked(apiClient.put).mockResolvedValue({ configured: true, settings });
    await putVoiceReminderSettings(settings);
    expect(apiClient.put).toHaveBeenCalledWith(
      "/api/v1/ui-prefs/notify/settings",
      { settings },
    );
  });

  it("fetches and puts fired keys", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ configured: false, keys: null });
    await fetchVoiceReminderFired();
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/ui-prefs/notify/fired");

    vi.mocked(apiClient.put).mockResolvedValue({
      configured: true,
      keys: ["e1::60::2026-07-24T10:00:00.000Z"],
    });
    await putVoiceReminderFired(["e1::60::2026-07-24T10:00:00.000Z"]);
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/ui-prefs/notify/fired", {
      keys: ["e1::60::2026-07-24T10:00:00.000Z"],
    });
  });

  it("claims fired keys before speak", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      configured: true,
      claimed: ["e1::60::2026-07-24T10:00:00.000Z"],
      keys: ["e1::60::2026-07-24T10:00:00.000Z"],
    });
    await claimVoiceReminderFired(["e1::60::2026-07-24T10:00:00.000Z"]);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/ui-prefs/notify/fired/claim",
      { keys: ["e1::60::2026-07-24T10:00:00.000Z"] },
    );
  });

  it("fetches and puts history", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ configured: false, entries: null });
    await fetchVoiceReminderHistory();
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/ui-prefs/notify/history");

    const entries = [
      {
        id: "1",
        triggerReason: "通知",
        status: "success" as const,
        errorMessage: null,
        triggeredAt: "2026-07-24T00:00:00.000Z",
      },
    ];
    vi.mocked(apiClient.put).mockResolvedValue({ configured: true, entries });
    await putVoiceReminderHistory(entries);
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/ui-prefs/notify/history", {
      entries,
    });
  });
});

describe("uiPrefs assistant sessions + voice IO", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.put).mockReset();
  });

  it("fetches and puts assistant sessions", async () => {
    const { fetchAssistantSessions, putAssistantSessions } = await import("./uiPrefs");
    vi.mocked(apiClient.get).mockResolvedValue({
      configured: false,
      sessions: null,
      activeSessionId: null,
    });
    await fetchAssistantSessions("device-a");
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/ui-prefs/assistant/sessions", {
      deviceId: "device-a",
    });

    const body = {
      deviceId: "device-a",
      sessions: [
        {
          id: "a1",
          title: "Hi",
          updatedAt: 1,
          messages: [{ id: "m1", role: "user" as const, content: "x" }],
        },
      ],
      activeSessionId: "a1",
    };
    vi.mocked(apiClient.put).mockResolvedValue({ configured: true, ...body });
    await putAssistantSessions(body);
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/ui-prefs/assistant/sessions", body);
  });

  it("fetches and puts assistant voice IO", async () => {
    const { fetchAssistantVoiceIo, putAssistantVoiceIo } = await import("./uiPrefs");
    vi.mocked(apiClient.get).mockResolvedValue({ configured: false, settings: null });
    await fetchAssistantVoiceIo();
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/ui-prefs/assistant/voice-io");

    const settings = {
      sttProvider: "browser",
      ttsProvider: "browser",
      ttsEnabled: true,
      speechLanguage: "zh-HK",
      spacePttMode: "hold" as const,
      ttsVoiceUri: "",
      defaultWorksetId: "__user__",
    };
    vi.mocked(apiClient.put).mockResolvedValue({ configured: true, settings });
    await putAssistantVoiceIo(settings);
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/ui-prefs/assistant/voice-io", {
      settings,
    });
  });
});
