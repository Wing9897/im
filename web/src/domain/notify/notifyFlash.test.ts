import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFY_FLASH_DURATION_MS,
  dismissNotifyFlash,
  loadNotifyFlashes,
  showNotifyFlash,
} from "./notifyFlash";
import { resetNotifyFlashForTests } from "./notifyFlash.testing";
describe("notifyFlash", () => {
  afterEach(() => {
    resetNotifyFlashForTests();
    vi.useRealTimers();
  });

  it("replaces the current flash and auto-dismisses timed items after 10s", () => {
    vi.useFakeTimers();
    showNotifyFlash("Alpha");
    showNotifyFlash("Beta");
    expect(loadNotifyFlashes().map((row) => row.text)).toEqual(["Beta"]);
    expect(loadNotifyFlashes()[0]?.persist).toBe(false);

    vi.advanceTimersByTime(NOTIFY_FLASH_DURATION_MS - 1);
    expect(loadNotifyFlashes()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(loadNotifyFlashes()).toEqual([]);
  });

  it("resets the timed fuse when a new flash replaces the current one", () => {
    vi.useFakeTimers();
    showNotifyFlash("Alpha");
    vi.advanceTimersByTime(8_000);
    showNotifyFlash("Beta");
    expect(loadNotifyFlashes().map((row) => row.text)).toEqual(["Beta"]);
    vi.advanceTimersByTime(8_000);
    expect(loadNotifyFlashes().map((row) => row.text)).toEqual(["Beta"]);
    vi.advanceTimersByTime(2_000);
    expect(loadNotifyFlashes()).toEqual([]);
  });

  it("keeps persistent flashes until dismissed", () => {
    vi.useFakeTimers();
    const id = showNotifyFlash("Stay", { persist: true });
    vi.advanceTimersByTime(NOTIFY_FLASH_DURATION_MS * 3);
    expect(loadNotifyFlashes().map((row) => row.id)).toEqual([id]);
    expect(loadNotifyFlashes()[0]?.persist).toBe(true);
    dismissNotifyFlash(id);
    expect(loadNotifyFlashes()).toEqual([]);
  });

  it("dismisses the current flash", () => {
    const first = showNotifyFlash("Keep");
    const second = showNotifyFlash("Drop");
    expect(loadNotifyFlashes().map((row) => row.id)).toEqual([second]);
    dismissNotifyFlash(first);
    expect(loadNotifyFlashes().map((row) => row.id)).toEqual([second]);
    dismissNotifyFlash(second);
    expect(loadNotifyFlashes()).toEqual([]);
  });
});
