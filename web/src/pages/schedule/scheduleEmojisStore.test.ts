import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hydrateScheduleEmojis,
  loadScheduleEmojis,
  resetScheduleEmojisCacheForTests,
  saveScheduleEmojis,
} from "./scheduleEmojisStore";

const { mockFetch, mockPut } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("../../api/uiPrefs", () => ({
  fetchScheduleEmojis: (...args: unknown[]) => mockFetch(...args),
  putScheduleEmojis: (...args: unknown[]) => mockPut(...args),
}));

describe("scheduleEmojisStore", () => {
  afterEach(() => {
    resetScheduleEmojisCacheForTests();
    mockFetch.mockReset();
    mockPut.mockReset();
  });

  it("hydrates a keyed emoji map from ui-prefs", async () => {
    mockFetch.mockResolvedValue({
      configured: true,
      emojis: { "oneOff:ue-1": "🎉", "recurring:rec-1": "🔁", "bad": "   " },
    });
    const map = await hydrateScheduleEmojis();
    expect(map).toEqual({ "oneOff:ue-1": "🎉", "recurring:rec-1": "🔁" });
    expect(loadScheduleEmojis()).toEqual(map);
  });

  it("PUTs the full map on save", async () => {
    mockPut.mockResolvedValue({ configured: true, emojis: { "oneOff:ue-1": "🎂" } });
    await expect(saveScheduleEmojis({ "oneOff:ue-1": "🎂" })).resolves.toBe(true);
    expect(mockPut).toHaveBeenCalledWith({ emojis: { "oneOff:ue-1": "🎂" } });
  });
});
