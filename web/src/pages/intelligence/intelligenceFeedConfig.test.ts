import { describe, expect, it, beforeEach } from "vitest";
import { makeAnalysisEvent } from "../../test/analysisEventFixtures";
import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import {
  getLoadMoreHint,
  getMapSyncCapHint,
  INTELLIGENCE_API_PAGE_SIZE,
  isMapSyncAtItemCap,
  MAP_SYNC_LOAD_MORE_PAGES,
  MAP_SYNC_MAX_ITEMS,
  MAP_SYNC_MAX_TOTAL_PAGES,
  MAP_SYNC_PAGE_RETRIES,
  mergeIntelligencePages,
} from "./intelligenceFeedConfig";

describe("intelligenceFeedConfig", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("aligns API page size with server cap", () => {
    expect(INTELLIGENCE_API_PAGE_SIZE).toBe(200);
  });

  it("defines map fill cap as 5 pages (1000 items) for has_coords window", () => {
    expect(MAP_SYNC_MAX_TOTAL_PAGES).toBe(5);
    expect(MAP_SYNC_MAX_ITEMS).toBe(1000);
    expect(MAP_SYNC_LOAD_MORE_PAGES).toBe(1);
    expect(MAP_SYNC_PAGE_RETRIES).toBe(2);
    expect(isMapSyncAtItemCap(MAP_SYNC_MAX_ITEMS - 1)).toBe(false);
    expect(isMapSyncAtItemCap(MAP_SYNC_MAX_ITEMS)).toBe(true);
    expect(getMapSyncCapHint()).toBe(
      "已達地圖自動載入上限，可載入下一批或縮小時間窗",
    );
  });

  it("getLoadMoreHint reflects cache, remote, and loading states", () => {
    expect(
      getLoadMoreHint({
        loadingMore: false,
        hasMoreCached: true,
        hasMoreRemote: false,
        hasIntelligenceItems: true,
      }),
    ).toBe("向下捲動以顯示更多");

    expect(
      getLoadMoreHint({
        loadingMore: false,
        hasMoreCached: false,
        hasMoreRemote: true,
        hasIntelligenceItems: true,
      }),
    ).toBe("向伺服器載入更多資料");

    expect(
      getLoadMoreHint({
        loadingMore: true,
        hasMoreCached: false,
        hasMoreRemote: true,
        hasIntelligenceItems: true,
      }),
    ).toBe("向伺服器載入更多…");

    expect(
      getLoadMoreHint({
        loadingMore: false,
        hasMoreCached: false,
        hasMoreRemote: false,
        hasIntelligenceItems: true,
      }),
    ).toBe("已載入全部情報事件");

    expect(
      getLoadMoreHint({
        loadingMore: false,
        hasMoreCached: false,
        hasMoreRemote: false,
        hasIntelligenceItems: false,
      }),
    ).toBe("");
  });

  it("smoke: English map sync cap hint", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    expect(getMapSyncCapHint()).toBe(
      "Map auto-load limit reached — load the next batch or narrow the time window",
    );
  });

  it("mergeIntelligencePages appends without duplicate ids", () => {
    const existing = [
      makeAnalysisEvent({
        id: "1",
        sourceMessageTime: "2026-04-17T10:00:00.000Z",
        createdAt: "2026-04-17T10:00:00.000Z",
        updatedAt: "2026-04-17T10:00:00.000Z",
      }),
    ];
    const incoming = [
      makeAnalysisEvent({
        id: "1",
        sourceMessageTime: "2026-04-17T10:00:00.000Z",
        createdAt: "2026-04-17T10:00:00.000Z",
        updatedAt: "2026-04-17T10:00:00.000Z",
      }),
      makeAnalysisEvent({
        id: "2",
        sourceMessageTime: "2026-04-17T11:00:00.000Z",
        createdAt: "2026-04-17T11:00:00.000Z",
        updatedAt: "2026-04-17T11:00:00.000Z",
      }),
    ];

    const merged = mergeIntelligencePages(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.id)).toEqual(["1", "2"]);
  });
});
