import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VOICE_REMINDER_SETTINGS,
  VOICE_REMINDER_SETTINGS_CHANGED_EVENT,
  hydrateVoiceReminderSettings,
  loadVoiceReminderSettings,
  normalizeVoiceReminderSettings,
  resetVoiceReminderSettingsCacheForTests,
  saveVoiceReminderSettings,
} from "./settings";

const {
  mockFetchSettings,
  mockPutSettings,
} = vi.hoisted(() => ({
  mockFetchSettings: vi.fn(),
  mockPutSettings: vi.fn(),
}));

vi.mock("../api/uiPrefs", () => ({
  fetchVoiceReminderSettings: (...args: unknown[]) => mockFetchSettings(...args),
  putVoiceReminderSettings: (...args: unknown[]) => mockPutSettings(...args),
}));

describe("voiceReminder settings", () => {
  beforeEach(() => {
    resetVoiceReminderSettingsCacheForTests();
    mockFetchSettings.mockReset();
    mockPutSettings.mockReset();
  });

  it("returns defaults before hydration", () => {
    expect(loadVoiceReminderSettings()).toEqual(DEFAULT_VOICE_REMINDER_SETTINGS);
  });

  it("persists via API and reloads from cache", async () => {
    const next = {
      enabled: true,
      leadOffsetsMinutes: [15, 1440] as const,
      taskIds: ["task-a"],
      preambleChimeId: "station" as const,
      quietHours: { enabled: false, start: "23:00", end: "06:30" },
    };
    mockPutSettings.mockResolvedValue({ configured: true, settings: next });
    const listener = vi.fn();
    window.addEventListener(VOICE_REMINDER_SETTINGS_CHANGED_EVENT, listener);

    await expect(saveVoiceReminderSettings({ ...next, leadOffsetsMinutes: [15, 1440] })).resolves.toBe(
      true,
    );
    expect(mockPutSettings).toHaveBeenCalledWith({
      enabled: true,
      leadOffsetsMinutes: [15, 1440],
      taskIds: ["task-a"],
      preambleChimeId: "station",
      quietHours: { enabled: false, start: "23:00", end: "06:30" },
    });
    expect(loadVoiceReminderSettings()).toEqual({
      enabled: true,
      leadOffsetsMinutes: [15, 1440],
      taskIds: ["task-a"],
      preambleChimeId: "station",
      quietHours: { enabled: false, start: "23:00", end: "06:30" },
    });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(VOICE_REMINDER_SETTINGS_CHANGED_EVENT, listener);
  });

  it("sanitizes taskIds and drops invalid leads", () => {
    expect(
      normalizeVoiceReminderSettings({
        enabled: true,
        leadOffsetsMinutes: [1440, 99, 15, 15],
        taskIds: ["x", "", 3],
      } as never),
    ).toEqual({
      enabled: true,
      leadOffsetsMinutes: [15, 1440],
      taskIds: ["x"],
      preambleChimeId: "broadcast",
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    });
  });

  it("treats quiet hours without an enabled flag as enabled", () => {
    expect(
      normalizeVoiceReminderSettings({
        enabled: true,
        leadOffsetsMinutes: [60],
        taskIds: [],
        quietHours: { start: "23:00", end: "06:00" },
      } as never).quietHours,
    ).toEqual({
      enabled: true,
      start: "23:00",
      end: "06:00",
    });
  });

  it("defaults missing taskIds to __user__ but keeps an explicit empty list", () => {
    expect(DEFAULT_VOICE_REMINDER_SETTINGS.taskIds).toEqual(["__user__"]);
    expect(normalizeVoiceReminderSettings({} as never).taskIds).toEqual(["__user__"]);
    expect(
      normalizeVoiceReminderSettings({
        enabled: false,
        leadOffsetsMinutes: [60],
        taskIds: [],
      } as never).taskIds,
    ).toEqual([]);
  });

  it("falls back to default chime for unknown / retired ids", () => {
    expect(
      normalizeVoiceReminderSettings({
        enabled: false,
        leadOffsetsMinutes: [60],
        taskIds: [],
        preambleChimeId: "not-a-real-chime",
      } as never).preambleChimeId,
    ).toBe("broadcast");
    expect(
      normalizeVoiceReminderSettings({
        enabled: false,
        leadOffsetsMinutes: [60],
        taskIds: [],
        preambleChimeId: "soft-bell",
      } as never).preambleChimeId,
    ).toBe("broadcast");
  });

  it("hydrates from server when configured", async () => {
    mockFetchSettings.mockResolvedValue({
      configured: true,
      settings: {
        enabled: true,
        leadOffsetsMinutes: [15],
        taskIds: ["t1"],
        preambleChimeId: "airport",
        quietHours: { enabled: false, start: "21:00", end: "06:00" },
      },
    });
    const loaded = await hydrateVoiceReminderSettings();
    expect(loaded.enabled).toBe(true);
    expect(loaded.preambleChimeId).toBe("airport");
    expect(mockPutSettings).not.toHaveBeenCalled();
  });

  it("uses defaults when server is empty", async () => {
    mockFetchSettings.mockResolvedValue({ configured: false, settings: null });

    const loaded = await hydrateVoiceReminderSettings();
    expect(mockPutSettings).not.toHaveBeenCalled();
    expect(loaded).toEqual(DEFAULT_VOICE_REMINDER_SETTINGS);
  });

  it("returns false and keeps prior cache when save fails", async () => {
    mockPutSettings
      .mockResolvedValueOnce({
        configured: true,
        settings: {
          ...DEFAULT_VOICE_REMINDER_SETTINGS,
          enabled: true,
        },
      })
      .mockRejectedValueOnce(new Error("boom"));

    await saveVoiceReminderSettings({
      ...DEFAULT_VOICE_REMINDER_SETTINGS,
      enabled: true,
    });
    expect(loadVoiceReminderSettings().enabled).toBe(true);

    await expect(
      saveVoiceReminderSettings({
        ...DEFAULT_VOICE_REMINDER_SETTINGS,
        enabled: false,
      }),
    ).resolves.toBe(false);
    expect(loadVoiceReminderSettings().enabled).toBe(true);
  });
});
