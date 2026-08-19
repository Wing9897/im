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

/** A client-only LS key — hydrate must ignore it (no LS→server bridge). */
const CLIENT_BOARD_LS_KEY = "im:board:v14";

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

  it("loads from API when configured and write-backs dropped flat sourceFilters", async () => {
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
    vi.mocked(putBoardPrefs).mockResolvedValue({
      configured: true,
      layout,
      widgetState: { mapViews: {}, sourceFilters: {}, ganttViewModes: {} },
    });

    const loaded = await hydrateBoardPrefs();
    expect(loaded.widgets).toHaveLength(8);
    expect(loadBoardMapViewFromCache("w-map")).toEqual({ center: [25, 121], zoom: 7 });
    // Flat legacy sourceFilters are dropped; hydrate write-backs the cleaned blob.
    expect(loadSourceFilterFromCache("w-gantt")).toEqual(null);
    expect(putBoardPrefs).toHaveBeenCalledWith({
      layout,
      widgetState: {
        mapViews: { "w-map": { center: [25, 121], zoom: 7 } },
        sourceFilters: {},
        ganttViewModes: {},
      },
    });
    expect(window.localStorage.getItem(CLIENT_BOARD_LS_KEY)).toBeNull();
  });

  it("seeds default layout when server empty (ignores leftover localStorage)", async () => {
    const leftover = createDefaultBoardConfig();
    leftover.widgets = leftover.widgets.slice(0, 8);
    window.localStorage.setItem(CLIENT_BOARD_LS_KEY, JSON.stringify(leftover));
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
    expect(window.localStorage.getItem(CLIENT_BOARD_LS_KEY)).toBeTruthy();
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
    expect(window.localStorage.getItem(CLIENT_BOARD_LS_KEY)).toBeNull();
  });

  it("hydrates hierarchical sourceFilters and write-backs dropped flat entries", async () => {
    const layout = createDefaultBoardConfig();
    vi.mocked(fetchBoardPrefs).mockResolvedValue({
      configured: true,
      layout,
      widgetState: {
        mapViews: {},
        sourceFilters: {
          "w-events": { taskIds: ["t1"], worksetIds: ["__general__"] },
          "w-legacy": ["old-a", "old-b"],
        },
        ganttViewModes: {},
      },
    });
    vi.mocked(putBoardPrefs).mockResolvedValue({
      configured: true,
      layout,
      widgetState: { mapViews: {}, sourceFilters: {}, ganttViewModes: {} },
    });
    await hydrateBoardPrefs();
    expect(loadSourceFilterFromCache("w-events")).toEqual({
      taskIds: ["t1"],
      worksetIds: ["__general__"],
    });
    expect(loadSourceFilterFromCache("w-legacy")).toBeNull();
    expect(putBoardPrefs).toHaveBeenCalledWith({
      layout,
      widgetState: {
        mapViews: {},
        sourceFilters: {
          "w-events": { taskIds: ["t1"], worksetIds: ["__general__"] },
        },
        ganttViewModes: {},
      },
    });
  });

  it("does not PUT when layout and widgetState are already canonical", async () => {
    const layout = createDefaultBoardConfig();
    const widgetState = {
      mapViews: { "w-map": { center: [25, 121], zoom: 7 } },
      sourceFilters: {
        "w-events": { taskIds: ["t1"], worksetIds: ["__general__"] },
      },
      ganttViewModes: { "w-gantt": "month" as const },
    };
    vi.mocked(fetchBoardPrefs).mockResolvedValue({
      configured: true,
      layout,
      widgetState,
    });
    await hydrateBoardPrefs();
    expect(putBoardPrefs).not.toHaveBeenCalled();
    expect(loadBoardGanttViewModeFromCache("w-gantt")).toBe("month");
  });

  it("write-backs bumped version when server layout version is older", async () => {
    const customWidgets = createDefaultBoardConfig().widgets.map((widget) =>
      widget.type === "map" ? { ...widget, col: 5, sizeId: "5x5" } : widget,
    );
    const stale = {
      version: BOARD_LAYOUT_VERSION - 1,
      widgets: customWidgets,
    };
    vi.mocked(fetchBoardPrefs).mockResolvedValue({
      configured: true,
      layout: stale,
      widgetState: { mapViews: {}, sourceFilters: {}, ganttViewModes: {} },
    });
    vi.mocked(putBoardPrefs).mockResolvedValue({
      configured: true,
      layout: null,
      widgetState: null,
    });
    const loaded = await hydrateBoardPrefs();
    expect(loaded.version).toBe(BOARD_LAYOUT_VERSION);
    expect(loaded.widgets.find((w) => w.type === "map")).toMatchObject({
      col: 5,
      sizeId: "5x5",
    });
    expect(putBoardPrefs).toHaveBeenCalledWith({
      layout: expect.objectContaining({
        version: BOARD_LAYOUT_VERSION,
        widgets: expect.arrayContaining([
          expect.objectContaining({ type: "map", col: 5, sizeId: "5x5" }),
        ]),
      }),
      widgetState: { mapViews: {}, sourceFilters: {}, ganttViewModes: {} },
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

  it("hydrates gantt view modes and write-backs invalid modes dropped", async () => {
    const layout = createDefaultBoardConfig();
    vi.mocked(fetchBoardPrefs).mockResolvedValue({
      configured: true,
      layout,
      widgetState: {
        mapViews: {},
        sourceFilters: {},
        ganttViewModes: { "g1": "month", "g2": "invalid", "g3": "day" },
      },
    });
    vi.mocked(putBoardPrefs).mockResolvedValue({
      configured: true,
      layout,
      widgetState: null,
    });
    await hydrateBoardPrefs();
    expect(loadBoardGanttViewModeFromCache("g1")).toBe("month");
    expect(loadBoardGanttViewModeFromCache("g3")).toBe("day");
    expect(loadBoardGanttViewModeFromCache("g2")).toBeNull();
    expect(putBoardPrefs).toHaveBeenCalledWith({
      layout,
      widgetState: {
        mapViews: {},
        sourceFilters: {},
        ganttViewModes: { "g1": "month", "g3": "day" },
      },
    });
  });

  it("falls back to defaults when GET fails (ignores localStorage)", async () => {
    const layout = createDefaultBoardConfig();
    layout.widgets = layout.widgets.slice(0, 8);
    window.localStorage.setItem(CLIENT_BOARD_LS_KEY, JSON.stringify(layout));
    vi.mocked(fetchBoardPrefs).mockRejectedValue(new Error("offline"));

    const loaded = await hydrateBoardPrefs();
    expect(loaded.widgets.length).toBe(createDefaultBoardConfig().widgets.length);
    expect(putBoardPrefs).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CLIENT_BOARD_LS_KEY)).toBeTruthy();
  });
});
