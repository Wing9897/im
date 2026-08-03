import { describe, expect, it, beforeEach, vi } from "vitest";
import { resolveBoardMapBootView } from "./embeds/MapBoardEmbed";
import {
  loadBoardMapViewFromCache,
  resetBoardPrefsCacheForTests,
  saveBoardMapViewToApi,
  seedBoardPrefsCacheForTests,
} from "./boardPrefsStore";
import { createDefaultBoardConfig } from "./boardLayoutParse";
import { putBoardPrefs } from "../api/uiPrefs";

/** Leftover historical LS key — assert map saves do not write LS (server SoT). */
const LEFTOVER_BOARD_LS_KEY = "im:ops-board:v14";

vi.mock("../api/uiPrefs", () => ({
  fetchBoardPrefs: vi.fn(),
  putBoardPrefs: vi.fn(async (body) => ({
    configured: true,
    layout: body.layout ?? null,
    widgetState: body.widgetState ?? null,
  })),
}));

/** sourceFilters persist coverage lives in boardPrefsStore.test.ts */

describe("board map view persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetBoardPrefsCacheForTests();
    seedBoardPrefsCacheForTests(createDefaultBoardConfig());
    vi.clearAllMocks();
  });

  it("saves and restores center/zoom per widgetId via prefs cache", () => {
    saveBoardMapViewToApi("map-a", { center: [25.0, 121.5], zoom: 6 });
    expect(loadBoardMapViewFromCache("map-a")).toEqual({ center: [25.0, 121.5], zoom: 6 });
    // Server ui-prefs is SoT — no localStorage write path for map views.
    expect(window.localStorage.getItem(LEFTOVER_BOARD_LS_KEY)).toBeNull();
    expect(loadBoardMapViewFromCache("map-b")).toBeNull();
    expect(putBoardPrefs).toHaveBeenCalled();
  });


  it("resolveBoardMapBootView re-reads cache so remounts see the latest save", () => {
    expect(resolveBoardMapBootView("w-map")).toBeNull();
    saveBoardMapViewToApi("w-map", { center: [25.04, 121.56], zoom: 8 });
    expect(resolveBoardMapBootView("w-map")).toEqual({
      center: [25.04, 121.56],
      zoom: 8,
    });
    expect(resolveBoardMapBootView("w-map", null)).toBeNull();
    expect(
      resolveBoardMapBootView("w-map", { center: [1, 2], zoom: 4 }),
    ).toEqual({ center: [1, 2], zoom: 4 });
  });
});
