import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  loadTaskFilterIds,
  saveTaskFilterIds,
} from "./useBoardTaskFilter";
import { resolveBoardMapBootView } from "./embeds/MapBoardEmbed";
import {
  loadBoardMapViewFromCache,
  resetBoardPrefsCacheForTests,
  saveBoardMapViewToApi,
  seedBoardPrefsCacheForTests,
} from "./boardPrefsStore";
import { createDefaultBoardConfig } from "./boardLayoutParse";
import { LEGACY_BOARD_STORAGE_KEY } from "./boardLegacyPersistedKeys";
import { putBoardPrefs } from "../api/uiPrefs";


vi.mock("../api/uiPrefs", () => ({
  fetchBoardPrefs: vi.fn(),
  putBoardPrefs: vi.fn(async (body) => ({
    configured: true,
    layout: body.layout ?? null,
    widgetState: body.widgetState ?? null,
  })),
}));

describe("useBoardTaskFilter persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetBoardPrefsCacheForTests();
    seedBoardPrefsCacheForTests(createDefaultBoardConfig());
    vi.clearAllMocks();
  });

  it("persists selected task ids per widget id in widgetState cache", () => {
    saveTaskFilterIds("w-gantt", ["a", "b"]);
    expect(loadTaskFilterIds("w-gantt")).toEqual(["a", "b"]);
    saveTaskFilterIds("w-gantt", null);
    expect(loadTaskFilterIds("w-gantt")).toBeNull();
    expect(window.localStorage.getItem(LEGACY_BOARD_STORAGE_KEY)).toBeNull();
  });
});

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
    expect(window.localStorage.getItem(LEGACY_BOARD_STORAGE_KEY)).toBeNull();
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
