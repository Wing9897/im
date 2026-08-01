/**
 * Unit tests for board prefs hydrate / save (API-backed).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchBoardPrefs, putBoardPrefs } from "../api/uiPrefs";
import { BOARD_LAYOUT_VERSION } from "./types";
import {
  hydrateBoardPrefs,
  loadBoardConfigFromCache,
  loadBoardMapViewFromCache,
  loadSourceFilterFromCache,
  loadBoardGanttViewModeFromCache,
  resetBoardPrefsCacheForTests,
  saveBoardLayoutToApi,
  saveBoardMapViewToApi,
  saveBoardGanttViewModeToApi,
  saveSourceFilterToApi,
} from "./boardPrefsStore";
import { createDefaultBoardConfig } from "./boardLayoutParse";

/** Legacy board layout LS key — server ui-prefs is SoT; assert leftover LS is ignored. */
const LEGACY_BOARD_STORAGE_KEY = "im:ops-board:v14";

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
        sourceFilters: { "w-gantt": ["t1"] },
        ganttViewModes: {},
      },
    });

    const loaded = await hydrateBoardPrefs();
    expect(loaded.widgets).toHaveLength(8);
    expect(loadBoardMapViewFromCache("w-map")).toEqual({ center: [25, 121], zoom: 7 });
    expect(loadSourceFilterFromCache("w-gantt")).toEqual(null);
    await vi.waitFor(() => {
      expect(putBoardPrefs).toHaveBeenCalledWith({
        widgetState: expect.objectContaining({
          sourceFilters: { "w-gantt": null },
        }),
      });
    });
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
      widgetState: body.widgetState ?? { mapViews: {}, sourceFilters: {}, ganttViewModes: {} },
    }));

    const loaded = await hydrateBoardPrefs();
    expect(loaded.version).toBe(BOARD_LAYOUT_VERSION);
    expect(loaded.widgets.length).toBe(createDefaultBoardConfig().widgets.length);
    expect(putBoardPrefs).toHaveBeenCalledWith({
      layout: expect.objectContaining({ version: BOARD_LAYOUT_VERSION }),
      widgetState: { mapViews: {}, sourceFilters: {}, ganttViewModes: {} },
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
        sourceFilters: {},
        ganttViewModes: {},
      },
    });

    saveSourceFilterToApi("w-gantt", { taskIds: ["t1"], worksetIds: ["ws-1"] });
    await vi.waitFor(() => {
      expect(putBoardPrefs).toHaveBeenLastCalledWith({
        widgetState: {
          mapViews: { "w-map": { center: [25, 121], zoom: 6 } },
          sourceFilters: { "w-gantt": { taskIds: ["t1"], worksetIds: ["ws-1"] } },
          ganttViewModes: {},
        },
      });
    });
    expect(window.localStorage.getItem(LEGACY_BOARD_STORAGE_KEY)).toBeNull();
  });

  it("hydrates hierarchical sourceFilters from API widgetState", async () => {
    vi.mocked(fetchBoardPrefs).mockResolvedValue({
      configured: true,
      layout: createDefaultBoardConfig(),
      widgetState: {
        mapViews: {},
        sourceFilters: {
          "w-events": { taskIds: ["t1"], worksetIds: ["__user__"] },
          "w-legacy": ["old-a", "old-b"],
        },
        ganttViewModes: {},
      },
    });
    await hydrateBoardPrefs();
    expect(loadSourceFilterFromCache("w-events")).toEqual({
      taskIds: ["t1"],
      worksetIds: ["__user__"],
    });
    expect(loadSourceFilterFromCache("w-legacy")).toBeNull();
    await vi.waitFor(() => {
      expect(putBoardPrefs).toHaveBeenCalledWith({
        widgetState: expect.objectContaining({
          sourceFilters: {
            "w-events": { taskIds: ["t1"], worksetIds: ["__user__"] },
            "w-legacy": null,
          },
        }),
      });
    });
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
        sourceFilters: {},
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
        sourceFilters: {},
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
