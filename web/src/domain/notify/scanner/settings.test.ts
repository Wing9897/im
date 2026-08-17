import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VOICE_REMINDER_SETTINGS,
  VOICE_REMINDER_SETTINGS_CHANGED_EVENT,
  hydrateVoiceReminderSettings,
  loadVoiceReminderSettings,
  normalizeVoiceReminderSettings,
  parseLeadOffsetMinutes,
  reminderChannelDelivery,
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

vi.mock("../../../api/uiPrefs", () => ({
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
    expect(loadVoiceReminderSettings()).not.toHaveProperty("sourceFilter");
  });

  it("persists via API and reloads from cache", async () => {
    const next = {
      enabled: true,
      voiceEnabled: true,
      flashEnabled: false,
      flashMode: "persistent" as const,
      leadOffsetsMinutes: [15, 1440] as const,
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
      voiceEnabled: true,
      flashEnabled: false,
      flashMode: "persistent",
      leadOffsetsMinutes: [15, 1440],
      preambleChimeId: "station",
      quietHours: { enabled: false, start: "23:00", end: "06:30" },
    });
    expect(loadVoiceReminderSettings()).toEqual({
      enabled: true,
      voiceEnabled: true,
      flashEnabled: false,
      flashMode: "persistent",
      leadOffsetsMinutes: [15, 1440],
      preambleChimeId: "station",
      quietHours: { enabled: false, start: "23:00", end: "06:30" },
    });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(VOICE_REMINDER_SETTINGS_CHANGED_EVENT, listener);
  });

  it("sanitizes invalid leads and ignores leftover sourceFilter", () => {
    expect(
      normalizeVoiceReminderSettings({
        enabled: true,
        leadOffsetsMinutes: [1440, 0, 15, 15, 10081],
        sourceFilter: { taskIds: ["x", ""], worksetIds: [] },
      } as never),
    ).toEqual({
      enabled: true,
      voiceEnabled: true,
      flashEnabled: true,
      flashMode: "timed",
      leadOffsetsMinutes: [15, 1440],
      preambleChimeId: "broadcast",
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    });
  });

  it("keeps custom minute offsets such as 30", () => {
    expect(parseLeadOffsetMinutes("30")).toBe(30);
    expect(parseLeadOffsetMinutes(0)).toBeNull();
    expect(parseLeadOffsetMinutes(10081)).toBeNull();
    expect(parseLeadOffsetMinutes(30.5)).toBeNull();
    expect(
      normalizeVoiceReminderSettings({
        leadOffsetsMinutes: [60, 30, 30, 0, 10081],
      } as never).leadOffsetsMinutes,
    ).toEqual([30, 60]);
  });

  it("persists a custom 30-minute lead through the prefs API", async () => {
    const next = {
      ...DEFAULT_VOICE_REMINDER_SETTINGS,
      enabled: true,
      leadOffsetsMinutes: [30, 60],
    };
    mockPutSettings.mockResolvedValue({ configured: true, settings: next });
    await expect(saveVoiceReminderSettings(next)).resolves.toBe(true);
    expect(mockPutSettings).toHaveBeenCalledWith(
      expect.objectContaining({ leadOffsetsMinutes: [30, 60] }),
    );
    expect(loadVoiceReminderSettings().leadOffsetsMinutes).toEqual([30, 60]);
  });

  it("treats quiet hours without an enabled flag as enabled", () => {
    expect(
      normalizeVoiceReminderSettings({
        enabled: true,
        leadOffsetsMinutes: [60],
        sourceFilter: null,
        quietHours: { start: "23:00", end: "06:00" },
      } as never).quietHours,
    ).toEqual({
      enabled: true,
      start: "23:00",
      end: "06:00",
    });
  });

  it("falls back to default chime for unknown / retired ids", () => {
    expect(
      normalizeVoiceReminderSettings({
        enabled: false,
        leadOffsetsMinutes: [60],
        preambleChimeId: "not-a-real-chime",
      } as never).preambleChimeId,
    ).toBe("broadcast");
    expect(
      normalizeVoiceReminderSettings({
        enabled: false,
        leadOffsetsMinutes: [60],
        preambleChimeId: "soft-bell",
      } as never).preambleChimeId,
    ).toBe("broadcast");
  });

  it("hydrates from server when configured and drops sourceFilter", async () => {
    mockFetchSettings.mockResolvedValue({
      configured: true,
      settings: {
        enabled: true,
        leadOffsetsMinutes: [15],
        sourceFilter: { taskIds: ["t1"], worksetIds: [] },
        preambleChimeId: "airport",
        quietHours: { enabled: false, start: "21:00", end: "06:00" },
      },
    });
    const loaded = await hydrateVoiceReminderSettings();
    expect(loaded.enabled).toBe(true);
    expect(loaded.preambleChimeId).toBe("airport");
    expect(loaded).not.toHaveProperty("sourceFilter");
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

  it("defaults missing voice/flash channels to on and flash mode to timed", () => {
    expect(
      normalizeVoiceReminderSettings({
        enabled: true,
        leadOffsetsMinutes: [60],
      } as never),
    ).toMatchObject({ voiceEnabled: true, flashEnabled: true, flashMode: "timed" });
    expect(
      normalizeVoiceReminderSettings({
        flashMode: "nope",
      } as never).flashMode,
    ).toBe("timed");
    expect(
      normalizeVoiceReminderSettings({
        flashMode: "persistent",
      } as never).flashMode,
    ).toBe("persistent");
  });

  it("keeps voice and flash independently off", () => {
    expect(
      reminderChannelDelivery({ voiceEnabled: true, flashEnabled: false, flashMode: "timed" }),
    ).toEqual({ speak: true, flash: false, flashPersist: false });
    expect(
      reminderChannelDelivery({ voiceEnabled: false, flashEnabled: true, flashMode: "persistent" }),
    ).toEqual({ speak: false, flash: true, flashPersist: true });
    expect(
      reminderChannelDelivery({ voiceEnabled: false, flashEnabled: false, flashMode: "timed" }),
    ).toEqual({ speak: false, flash: false, flashPersist: false });
    expect(
      reminderChannelDelivery({ voiceEnabled: true, flashEnabled: true, flashMode: "timed" }),
    ).toEqual({ speak: true, flash: true, flashPersist: false });
  });
});
