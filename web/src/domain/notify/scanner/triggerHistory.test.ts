import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import {
  NOTIFY_HISTORY_CHANGED_EVENT,
  appendNotifyTrigger,
  buildNotifyTriggerReason,
  hydrateNotifyHistory,
  loadNotifyTriggers,
  resetNotifyHistoryCacheForTests,
} from "./triggerHistory";

const { mockFetchHistory, mockPutHistory } = vi.hoisted(() => ({
  mockFetchHistory: vi.fn(),
  mockPutHistory: vi.fn(),
}));

vi.mock("../../../api/uiPrefs", () => ({
  fetchNotifyHistory: (...args: unknown[]) => mockFetchHistory(...args),
  putNotifyHistory: (...args: unknown[]) => mockPutHistory(...args),
}));

describe("notify triggerHistory", () => {
  beforeEach(async () => {
    resetNotifyHistoryCacheForTests();
    mockFetchHistory.mockReset();
    mockPutHistory.mockReset();
    mockPutHistory.mockImplementation(async (_entries: unknown) => ({
      configured: true,
      entries: _entries,
    }));
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  afterEach(() => {
    resetNotifyHistoryCacheForTests();
  });

  it("appends newest-first and notifies listeners", async () => {
    const listener = vi.fn();
    window.addEventListener(NOTIFY_HISTORY_CHANGED_EVENT, listener);

    const first = await appendNotifyTrigger({
      triggerReason: "通知 · 約一小時 · 「A」",
      status: "success",
      title: "A",
    });
    const second = await appendNotifyTrigger({
      triggerReason: "通知 · 約十五分鐘 · 「B」",
      status: "failure",
      errorMessage: "朗讀失敗",
      title: "B",
    });

    const loaded = loadNotifyTriggers();
    expect(loaded[0]?.id).toBe(second.entry.id);
    expect(loaded[1]?.id).toBe(first.entry.id);
    expect(loaded[0]?.errorMessage).toBe("朗讀失敗");
    expect(first.persisted).toBe(true);
    expect(second.persisted).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener(NOTIFY_HISTORY_CHANGED_EVENT, listener);
  });

  it("uses empty history when server is empty", async () => {
    mockFetchHistory.mockResolvedValue({ configured: false, entries: null });

    const loaded = await hydrateNotifyHistory();
    expect(mockPutHistory).not.toHaveBeenCalled();
    expect(loaded).toEqual([]);
  });

  it("reports persisted=false when API save fails but keeps memory row", async () => {
    mockPutHistory.mockRejectedValue(new Error("offline"));
    const { entry, persisted } = await appendNotifyTrigger({
      triggerReason: "通知 · 約一小時 · 「X」",
      status: "success",
    });
    expect(persisted).toBe(false);
    expect(loadNotifyTriggers()[0]?.id).toBe(entry.id);
  });

  it("builds a stable trigger reason", () => {
    expect(buildNotifyTriggerReason("  標題  ", "約一小時")).toBe(
      "通知 · 約一小時 · 「標題」",
    );
    expect(buildNotifyTriggerReason("   ", "約十五分鐘")).toBe(
      "通知 · 約十五分鐘 · 「情報事件」",
    );
  });
});
