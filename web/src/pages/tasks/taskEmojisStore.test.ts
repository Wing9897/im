import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hydrateTaskEmojis,
  loadTaskEmojis,
  resetTaskEmojisCacheForTests,
  saveTaskEmojis,
} from "./taskEmojisStore";

const { mockFetch, mockPut } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock("../../api/uiPrefs", () => ({
  fetchTaskEmojis: (...args: unknown[]) => mockFetch(...args),
  putTaskEmojis: (...args: unknown[]) => mockPut(...args),
}));

describe("taskEmojisStore", () => {
  afterEach(() => {
    resetTaskEmojisCacheForTests();
    mockFetch.mockReset();
    mockPut.mockReset();
  });

  it("hydrates a keyed emoji map from ui-prefs", async () => {
    mockFetch.mockResolvedValue({
      configured: true,
      emojis: { "task-1": "🎯", "task-2": "📌", bad: "   " },
    });
    const map = await hydrateTaskEmojis();
    expect(map).toEqual({ "task-1": "🎯", "task-2": "📌" });
    expect(loadTaskEmojis()).toEqual(map);
  });

  it("PUTs the full map on save", async () => {
    mockPut.mockResolvedValue({ configured: true, emojis: { "task-1": "🎯" } });
    await expect(saveTaskEmojis({ "task-1": "🎯" })).resolves.toBe(true);
    expect(mockPut).toHaveBeenCalledWith({ emojis: { "task-1": "🎯" } });
  });

  it("does not let a stale unconfigured GET overwrite a save", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );
    mockPut.mockResolvedValue({ configured: true, emojis: { "task-1": "🎯" } });

    const hydrating = hydrateTaskEmojis();
    await Promise.resolve();
    await saveTaskEmojis({ "task-1": "🎯" });
    expect(loadTaskEmojis()).toEqual({ "task-1": "🎯" });

    resolveFetch({ configured: false, emojis: null });
    await expect(hydrating).resolves.toEqual({ "task-1": "🎯" });
    expect(loadTaskEmojis()).toEqual({ "task-1": "🎯" });
  });

  it("rethrows when PUT fails so the picker can retry", async () => {
    mockPut.mockRejectedValue(new Error("404"));
    await expect(saveTaskEmojis({ "task-1": "🎯" })).rejects.toThrow("404");
    expect(loadTaskEmojis()).toEqual({});
  });
});
