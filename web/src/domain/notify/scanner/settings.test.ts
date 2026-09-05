import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NOTIFY_SETTINGS,
  NOTIFY_SETTINGS_CHANGED_EVENT,
  hydrateNotifySettings,
  loadNotifySettings,
  normalizeNotifySettings,
  parseLeadOffsetMinutes,
  reminderChannelDelivery,
  saveNotifySettings,
} from "./settings";
import { resetNotifySettingsCacheForTests } from "./settings.testing";
const { mockFetchSettings, mockPutSettings } = vi.hoisted(() => ({
  mockFetchSettings: vi.fn(),
  mockPutSettings: vi.fn(),
}));

vi.mock("../../../api/uiPrefs", () => ({
  fetchNotifySettings: (...args: unknown[]) => mockFetchSettings(...args),
  putNotifySettings: (...args: unknown[]) => mockPutSettings(...args),
}));

describe("notify settings", () => {
  beforeEach(() => {
    resetNotifySettingsCacheForTests();
    mockFetchSettings.mockReset();
    mockPutSettings.mockReset();
  });

  it("returns defaults before hydration", () => {
    expect(loadNotifySettings()).toEqual(DEFAULT_NOTIFY_SETTINGS);
    expect(loadNotifySettings()).not.toHaveProperty("sourceFilter");
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
    window.addEventListener(NOTIFY_SETTINGS_CHANGED_EVENT, listener);

    await expect(
      saveNotifySettings({ ...next, leadOffsetsMinutes: [15, 1440] }),
    ).resolves.toBe(true);
    expect(mockPutSettings).toHaveBeenCalledWith({
      enabled: true,
      voiceEnabled: true,
      flashEnabled: false,
      flashMode: "persistent",
      leadOffsetsMinutes: [15, 1440],
      preambleChimeId: "station",
      quietHours: { enabled: false, start: "23:00", end: "06:30" },
    });
    expect(loadNotifySettings()).toEqual({
      enabled: true,
      voiceEnabled: true,
      flashEnabled: false,
      flashMode: "persistent",
      leadOffsetsMinutes: [15, 1440],
      preambleChimeId: "station",
      quietHours: { enabled: false, start: "23:00", end: "06:30" },
    });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(NOTIFY_SETTINGS_CHANGED_EVENT, listener);
  });

  it("sanitizes invalid leads and ignores leftover sourceFilter", () => {
    expect(
      normalizeNotifySettings({
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
      normalizeNotifySettings({
        leadOffsetsMinutes: [60, 30, 30, 0, 10081],
      } as never).leadOffsetsMinutes,
    ).toEqual([30, 60]);
  });

  it("persists a custom 30-minute lead through the prefs API", async () => {
    const next = {
      ...DEFAULT_NOTIFY_SETTINGS,
      enabled: true,
      leadOffsetsMinutes: [30, 60],
    };
    mockPutSettings.mockResolvedValue({ configured: true, settings: next });
    await expect(saveNotifySettings(next)).resolves.toBe(true);
    expect(mockPutSettings).toHaveBeenCalledWith(
      expect.objectContaining({ leadOffsetsMinutes: [30, 60] }),
    );
    expect(loadNotifySettings().leadOffsetsMinutes).toEqual([30, 60]);
  });

  it("treats quiet hours without an enabled flag as enabled", () => {
    expect(
      normalizeNotifySettings({
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
      normalizeNotifySettings({
        enabled: false,
        leadOffsetsMinutes: [60],
        preambleChimeId: "not-a-real-chime",
      } as never).preambleChimeId,
    ).toBe("broadcast");
    expect(
      normalizeNotifySettings({
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
    const loaded = await hydrateNotifySettings();
    expect(loaded.enabled).toBe(true);
    expect(loaded.preambleChimeId).toBe("airport");
    expect(loaded).not.toHaveProperty("sourceFilter");
    expect(mockPutSettings).not.toHaveBeenCalled();
  });

  it("uses defaults when server is empty", async () => {
    mockFetchSettings.mockResolvedValue({ configured: false, settings: null });

    const loaded = await hydrateNotifySettings();
    expect(mockPutSettings).not.toHaveBeenCalled();
    expect(loaded).toEqual(DEFAULT_NOTIFY_SETTINGS);
  });

  it("returns false and keeps prior cache when save fails", async () => {
    mockPutSettings
      .mockResolvedValueOnce({
        configured: true,
        settings: {
          ...DEFAULT_NOTIFY_SETTINGS,
          enabled: true,
        },
      })
      .mockRejectedValueOnce(new Error("boom"));

    await saveNotifySettings({
      ...DEFAULT_NOTIFY_SETTINGS,
      enabled: true,
    });
    expect(loadNotifySettings().enabled).toBe(true);

    await expect(
      saveNotifySettings({
        ...DEFAULT_NOTIFY_SETTINGS,
        enabled: false,
      }),
    ).resolves.toBe(false);
    expect(loadNotifySettings().enabled).toBe(true);
  });

  it("defaults missing voice/flash channels to on and flash mode to timed", () => {
    expect(
      normalizeNotifySettings({
        enabled: true,
        leadOffsetsMinutes: [60],
      } as never),
    ).toMatchObject({
      voiceEnabled: true,
      flashEnabled: true,
      flashMode: "timed",
    });
    expect(
      normalizeNotifySettings({
        flashMode: "nope",
      } as never).flashMode,
    ).toBe("timed");
    expect(
      normalizeNotifySettings({
        flashMode: "persistent",
      } as never).flashMode,
    ).toBe("persistent");
  });

  it("keeps voice and flash independently off", () => {
    expect(
      reminderChannelDelivery({
        voiceEnabled: true,
        flashEnabled: false,
        flashMode: "timed",
      }),
    ).toEqual({ speak: true, flash: false, flashPersist: false });
    expect(
      reminderChannelDelivery({
        voiceEnabled: false,
        flashEnabled: true,
        flashMode: "persistent",
      }),
    ).toEqual({ speak: false, flash: true, flashPersist: true });
    expect(
      reminderChannelDelivery({
        voiceEnabled: false,
        flashEnabled: false,
        flashMode: "timed",
      }),
    ).toEqual({ speak: false, flash: false, flashPersist: false });
    expect(
      reminderChannelDelivery({
        voiceEnabled: true,
        flashEnabled: true,
        flashMode: "timed",
      }),
    ).toEqual({ speak: true, flash: true, flashPersist: false });
  });
});
