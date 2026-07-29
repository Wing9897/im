/**
 * Unit tests for board prefs hydrate / save (API-backed).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchBoardPrefs, putBoardPrefs } from "../api/uiPrefs";
import { BOARD_LAYOUT_VERSION } from "./types";
import { LEGACY_BOARD_STORAGE_KEY } from "./boardLegacyPersistedKeys";
import {
  hydrateBoardPrefs,
  loadBoardConfigFromCache,
  loadBoardMapViewFromCache,
  loadTaskFilterIdsFromCache,
  loadBoardGanttViewModeFromCache,
  resetBoardPrefsCacheForTests,
  saveBoardLayoutToApi,
  saveBoardMapViewToApi,
  saveBoardGanttViewModeToApi,
  saveTaskFilterIdsToApi,
} from "./boardPrefsStore";
import { createDefaultBoardConfig } from "./boardLayoutParse";

vi.mock("../api/uiPrefs", () => ({
  fetchBoardPrefs: vi.fn(),
  putBoardPrefs: vi.fn(),
}));

describe("boardPrefsStore hydrate / save", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetBoardPrefsCacheForTests();
    vi.clearAllMocks();
  });

  it("loads from API when configured", async () => {
    const layout = createDefaultBoardConfig();
    layout.widgets = layout.widgets.slice(0, 8);
    vi.mocked(fetchBoardPrefs).mockResolvedValue({
      configured: true,
      layout,
      widgetState: {
        mapViews: { "w-map": { center: [25, 121], zoom: 7 } },
        taskFilters: { "w-gantt": ["t1"] },
        ganttViewModes: {},
      },
    });

    const loaded = await hydrateBoardPrefs();
    expect(loaded.widgets).toHaveLength(8);
    expect(loadBoardMapViewFromCache("w-map")).toEqual({ center: [25, 121], zoom: 7 });
    expect(loadTaskFilterIdsFromCache("w-gantt")).toEqual(["t1"]);
    expect(putBoardPrefs).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LEGACY_BOARD_STORAGE_KEY)).toBeNull();
  });

  it("seeds default layout when server empty (ignores leftover localStorage)", async () => {
    const leftover = createDefaultBoardConfig();
    leftover.widgets = leftover.widgets.slice(0, 8);
    window.localStorage.setItem(LEGACY_BOARD_STORAGE_KEY, JSON.stringify(leftover));
    vi.mocked(fetchBoardPrefs).mockResolvedValue({
      configured: false,
      layout: null,
      widgetState: null,
    });
    vi.mocked(putBoardPrefs).mockImplementation(async (body) => ({
      configured: true,
      layout: body.layout ?? null,
      widgetState: body.widgetState ?? { mapViews: {}, taskFilters: {}, ganttViewModes: {} },
    }));

    const loaded = await hydrateBoardPrefs();
    expect(loaded.version).toBe(BOARD_LAYOUT_VERSION);
    expect(loaded.widgets.length).toBe(createDefaultBoardConfig().widgets.length);
    expect(putBoardPrefs).toHaveBeenCalledWith({
      layout: expect.objectContaining({ version: BOARD_LAYOUT_VERSION }),
      widgetState: { mapViews: {}, taskFilters: {}, ganttViewModes: {} },
    });
    // Hard-cut: leftover LS is not cleared and not used as SoT.
    expect(window.localStorage.getItem(LEGACY_BOARD_STORAGE_KEY)).toBeTruthy();
  });

  it("saveBoardLayoutToApi PUTs layout only", async () => {
    vi.mocked(putBoardPrefs).mockResolvedValue({
      configured: true,
      layout: null,
      widgetState: null,
    });
    const layout = createDefaultBoardConfig();
    saveBoardLayoutToApi(layout);
    await vi.waitFor(() => {
      expect(putBoardPrefs).toHaveBeenCalledWith({ layout });
    });
    expect(loadBoardConfigFromCache()).toEqual(layout);
  });

  it("map + task filter saves PUT full widgetState", async () => {
    vi.mocked(putBoardPrefs).mockResolvedValue({
      configured: true,
      layout: null,
      widgetState: null,
    });
    saveBoardMapViewToApi("w-map", { center: [25, 121], zoom: 6 });
    await vi.waitFor(() => expect(putBoardPrefs).toHaveBeenCalled());
    expect(putBoardPrefs).toHaveBeenLastCalledWith({
      widgetState: {
        mapViews: { "w-map": { center: [25, 121], zoom: 6 } },
        taskFilters: {},
        ganttViewModes: {},
      },
    });

    saveTaskFilterIdsToApi("w-gantt", ["t1"]);
    await vi.waitFor(() => {
      expect(putBoardPrefs).toHaveBeenLastCalledWith({
        widgetState: {
          mapViews: { "w-map": { center: [25, 121], zoom: 6 } },
          taskFilters: { "w-gantt": ["t1"] },
          ganttViewModes: {},
        },
      });
    });
    expect(window.localStorage.getItem(LEGACY_BOARD_STORAGE_KEY)).toBeNull();
  });

  it("persists gantt view mode per widget in widgetState", async () => {
    vi.mocked(putBoardPrefs).mockResolvedValue({
      configured: true,
      layout: null,
      widgetState: null,
    });
    saveBoardGanttViewModeToApi("w-gantt", "day");
    await vi.waitFor(() => expect(putBoardPrefs).toHaveBeenCalled());
    expect(putBoardPrefs).toHaveBeenLastCalledWith({
      widgetState: {
        mapViews: {},
        taskFilters: {},
        ganttViewModes: { "w-gantt": "day" },
      },
    });
    expect(loadBoardGanttViewModeFromCache("w-gantt")).toBe("day");
  });

  it("hydrates gantt view modes from API widgetState", async () => {
    vi.mocked(fetchBoardPrefs).mockResolvedValue({
      configured: true,
      layout: createDefaultBoardConfig(),
      widgetState: {
        mapViews: {},
        taskFilters: {},
        ganttViewModes: { "g1": "month", "g2": "invalid", "g3": "day" },
      },
    });
    await hydrateBoardPrefs();
    expect(loadBoardGanttViewModeFromCache("g1")).toBe("month");
    expect(loadBoardGanttViewModeFromCache("g3")).toBe("day");
    expect(loadBoardGanttViewModeFromCache("g2")).toBeNull();
  });

  it("falls back to defaults when GET fails (ignores localStorage)", async () => {
    const layout = createDefaultBoardConfig();
    layout.widgets = layout.widgets.slice(0, 8);
    window.localStorage.setItem(LEGACY_BOARD_STORAGE_KEY, JSON.stringify(layout));
    vi.mocked(fetchBoardPrefs).mockRejectedValue(new Error("offline"));

    const loaded = await hydrateBoardPrefs();
    expect(loaded.widgets.length).toBe(createDefaultBoardConfig().widgets.length);
    expect(putBoardPrefs).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LEGACY_BOARD_STORAGE_KEY)).toBeTruthy();
  });
});
