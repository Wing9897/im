import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BOARD_LAYOUT_VERSION,
  type BoardConfig,
} from "./types";
import {
  addWidget,
  createDefaultBoardConfig,
  exportBoardConfig,
  findFreePlacement,
  hydrateBoardPrefs,
  importBoardConfig,
  loadBoardConfig,
  parseBoardConfig,
  removeWidget,
  resetBoardConfig,
  resetBoardPrefsCacheForTests,
  saveBoardConfig,
  seedBoardPrefsCacheForTests,
  updateWidgetSizeId,
  widgetDesignRect,
} from "./boardLayoutStore";
import { BOARD_WIDGET_DESCRIPTORS, BOARD_WIDGET_TYPES, getWidgetMeta } from "./widgetRegistry";
import {
  BOARD_DESIGN_HEIGHT,
  BOARD_DESIGN_WIDTH,
  BOARD_GRID_COLS,
  BOARD_GRID_ROWS,
  rectsOverlap,
} from "./boardSizePresets";
import { fetchBoardPrefs, putBoardPrefs } from "../api/uiPrefs";

vi.mock("../api/uiPrefs", () => ({
  fetchBoardPrefs: vi.fn(),
  putBoardPrefs: vi.fn(),
}));

describe("boardLayoutStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetBoardPrefsCacheForTests();
    vi.clearAllMocks();
    vi.mocked(putBoardPrefs).mockImplementation(async (body) => ({
      configured: true,
      layout: (body.layout as BoardConfig) ?? null,
      widgetState: body.widgetState ?? null,
    }));
    vi.mocked(fetchBoardPrefs).mockResolvedValue({
      configured: false,
      layout: null,
      widgetState: null,
    });
  });

  it("returns default size-preset config when cache empty", () => {
    const config = loadBoardConfig();
    expect(config.version).toBe(BOARD_LAYOUT_VERSION);
    expect(config.widgets.length).toBeGreaterThan(0);
    expect(config.widgets[0]!.sizeId).toMatch(/^\d+x\d+$/);
    expect(config.widgets.map((w) => w.type)).toEqual(
      expect.arrayContaining([
        "map",
        "wall",
        "weather",
        "clock",
        "system",
        "gantt",
        "gantt-events",
        "events",
        "feed",
        "calendar",
        "calendar-day",
        "leaderboard",
        "stats",
        "tasks",
        "queue",
        "logs",
        "actions",
        "sources",
      ]),
    );
  });

  it("exposes Traditional Chinese display titles for events and feed", () => {
    expect(BOARD_WIDGET_DESCRIPTORS.events.titleKey).toBe("widgets.events.title");
    expect(getWidgetMeta("events").title).toBe("關鍵事件");
    expect(getWidgetMeta("feed").title).toBe("實時監控");
    expect(getWidgetMeta("wall").title).toBe("訊息牆");
    expect(getWidgetMeta("gantt").title).toBe("甘特／按任務");
    expect(getWidgetMeta("gantt-events").title).toBe("甘特／按事件");
    expect(getWidgetMeta("calendar").title).toBe("月曆");
    expect(getWidgetMeta("calendar-day").title).toBe("日程");
    expect(getWidgetMeta("weather").title).toBe("天氣");
    expect(BOARD_WIDGET_DESCRIPTORS.weather.defaultSizeId).toBe("5x2");
    expect(BOARD_WIDGET_DESCRIPTORS.map.defaultSizeId).toBe("5x3");
    expect(BOARD_WIDGET_DESCRIPTORS.map.sizeOptions).toContain("5x3");
    expect(BOARD_WIDGET_DESCRIPTORS.map.sizeOptions).toContain("4x3");
    expect(BOARD_WIDGET_DESCRIPTORS.events.sizeOptions).toEqual(
      expect.arrayContaining(["3x4", "3x5", "4x4", "4x5", "4x6"]),
    );
    expect(BOARD_WIDGET_DESCRIPTORS.feed.sizeOptions).toEqual(
      expect.arrayContaining(["3x4", "3x5", "4x4", "4x5", "4x6"]),
    );
    expect(BOARD_WIDGET_DESCRIPTORS.gantt.defaultSizeId).toBe("16x1");
    expect(BOARD_WIDGET_DESCRIPTORS["calendar-day"].defaultSizeId).toBe("5x1");
    for (const type of Object.keys(BOARD_WIDGET_DESCRIPTORS) as Array<
      keyof typeof BOARD_WIDGET_DESCRIPTORS
    >) {
      for (const id of ["3x1", "4x1", "3x2", "4x2", "5x3", "6x4"] as const) {
        expect(BOARD_WIDGET_DESCRIPTORS[type].sizeOptions).toContain(id);
      }
    }
  });

  it("default mosaic fills design bounds without overlapping widgets", () => {
    const config = createDefaultBoardConfig();
    const rects = config.widgets.map((w) => widgetDesignRect(w));
    const maxRight = Math.max(...rects.map((r) => r.x + r.w));
    const maxBottom = Math.max(...rects.map((r) => r.y + r.h));
    expect(maxRight).toBeLessThanOrEqual(BOARD_DESIGN_WIDTH);
    expect(maxBottom).toBeLessThanOrEqual(BOARD_DESIGN_HEIGHT);
    expect(config.widgets).toHaveLength(18);
    expect(config.widgets.find((w) => w.type === "gantt")).toMatchObject({
      col: 0,
      row: 0,
      sizeId: "16x1",
    });
    expect(config.widgets.find((w) => w.type === "gantt-events")).toMatchObject({
      col: 0,
      row: 1,
      sizeId: "16x1",
    });
    expect(config.widgets.find((w) => w.type === "clock")).toMatchObject({
      col: 0,
      row: 2,
      sizeId: "3x1",
    });
    expect(config.widgets.find((w) => w.type === "system")).toMatchObject({
      col: 0,
      row: 3,
      sizeId: "3x1",
    });
    expect(config.widgets.find((w) => w.type === "actions")).toMatchObject({
      col: 0,
      row: 4,
      sizeId: "3x2",
    });
    expect(config.widgets.find((w) => w.type === "leaderboard")).toMatchObject({
      col: 0,
      row: 6,
      sizeId: "3x2",
    });
    expect(config.widgets.find((w) => w.type === "logs")).toMatchObject({
      col: 0,
      row: 8,
      sizeId: "3x2",
    });
    expect(config.widgets.find((w) => w.type === "map")).toMatchObject({
      col: 3,
      row: 2,
      sizeId: "5x3",
    });
    expect(config.widgets.find((w) => w.type === "wall")).toMatchObject({
      col: 8,
      row: 2,
      sizeId: "3x3",
    });
    expect(config.widgets.find((w) => w.type === "calendar")).toMatchObject({
      col: 11,
      row: 2,
      sizeId: "5x3",
    });
    expect(config.widgets.find((w) => w.type === "calendar-day")).toMatchObject({
      col: 11,
      row: 5,
      sizeId: "5x1",
    });
    expect(config.widgets.find((w) => w.type === "weather")).toMatchObject({
      col: 3,
      row: 5,
      sizeId: "5x2",
    });
    expect(config.widgets.find((w) => w.type === "events")?.sizeId).toBe("4x3");
    expect(config.widgets.map((w) => w.type)).toEqual(
      expect.arrayContaining(["map", "wall", "weather", "gantt", "gantt-events", "events", "stats", "queue", "sources"]),
    );
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  it("parseBoardConfig resets sparse v13 layouts to v14 defaults", () => {
    const parsed = parseBoardConfig({
      version: 13,
      widgets: [
        { i: "w-map", type: "map", col: 5, row: 0, sizeId: "5x3", z: 1 },
        { i: "w-wall", type: "wall", col: 0, row: 0, sizeId: "4x3", z: 2 },
        { i: "w-weather", type: "weather", col: 0, row: 3, sizeId: "5x2", z: 3 },
        { i: "w-gantt", type: "gantt", col: 0, row: 0, sizeId: "16x1", z: 4 },
        { i: "w-gantt-events", type: "gantt-events", col: 0, row: 1, sizeId: "16x1", z: 5 },
        { i: "w-clock", type: "clock", col: 0, row: 2, sizeId: "3x1", z: 6 },
      ],
    });
    expect(parsed.version).toBe(BOARD_LAYOUT_VERSION);
    expect(parsed.widgets).toHaveLength(createDefaultBoardConfig().widgets.length);
    expect(parsed.widgets.find((widget) => widget.type === "calendar")).toMatchObject({
      col: 11,
      row: 2,
      sizeId: "5x3",
    });
  });

  it("parseBoardConfig resets older version layouts to v14 defaults", () => {
    const parsed = parseBoardConfig({
      version: 12,
      widgets: createDefaultBoardConfig().widgets.map((widget) =>
        widget.type === "map" ? { ...widget, col: 5, sizeId: "5x5" } : widget,
      ),
    });
    expect(parsed.version).toBe(BOARD_LAYOUT_VERSION);
    expect(parsed.widgets.find((widget) => widget.type === "map")).toMatchObject({
      col: 3,
      row: 2,
      sizeId: "5x3",
    });
  });

  it("persists and reloads a filled custom config via memory cache", () => {
    const config = createDefaultBoardConfig();
    config.widgets = config.widgets.slice(0, 8);
    saveBoardConfig(config);
    const loaded = loadBoardConfig();
    expect(loaded.widgets).toHaveLength(8);
    expect(loaded.widgets[0]?.type).toBe(config.widgets[0]?.type);
  });

  it("hydrate seeds default when server empty", async () => {
    const loaded = await hydrateBoardPrefs();
    expect(loaded.widgets.length).toBeGreaterThan(0);
    expect(putBoardPrefs).toHaveBeenCalled();
  });

  it("falls back on invalid JSON / schema via parseBoardConfig", () => {
    expect(loadBoardConfig().widgets.length).toBeGreaterThan(0);
    expect(
      parseBoardConfig({ version: 1, widgets: [{ i: "x", type: "nope", x: 0, y: 0, w: 1, h: 1 }] })
        .widgets.length,
    ).toBeGreaterThan(0);
  });

  it("exports and imports a layout round-trip", () => {
    seedBoardPrefsCacheForTests(createDefaultBoardConfig());
    const config = createDefaultBoardConfig();
    const json = exportBoardConfig(config);
    const imported = importBoardConfig(json);
    expect(imported).toEqual(config);
    expect(loadBoardConfig()).toEqual(config);
  });

  it("rejects invalid imported JSON instead of replacing the current layout", () => {
    const existing = createDefaultBoardConfig();
    saveBoardConfig(existing);
    expect(() => importBoardConfig("{invalid")).toThrow("版面 JSON 格式無效");
    expect(loadBoardConfig()).toEqual(existing);
  });

  it("rejects unknown widget types when parsing", () => {
    const parsed = parseBoardConfig({
      version: BOARD_LAYOUT_VERSION,
      widgets: [{ i: "x", type: "nope", col: 0, row: 0, sizeId: "3x2" }],
    });
    expect(parsed.version).toBe(BOARD_LAYOUT_VERSION);
    expect(parsed.widgets.length).toBe(createDefaultBoardConfig().widgets.length);
  });

  it("addWidget / removeWidget persist", () => {
    let config = createDefaultBoardConfig();
    const before = config.widgets.length;
    config = addWidget(config, "queue");
    expect(config.widgets).toHaveLength(before + 1);
    expect(config.widgets.at(-1)?.type).toBe("queue");
    const id = config.widgets.at(-1)!.i;
    config = removeWidget(config, id);
    expect(config.widgets).toHaveLength(before);
  });

  it("addWidget places new frames inside the 16×10 canvas (not below maxRow)", () => {
    const config = addWidget(createDefaultBoardConfig(), "wall");
    const added = config.widgets.at(-1)!;
    expect(added.type).toBe("wall");
    expect(added.sizeId).toBe("3x3");
    // Default mosaic is dense — cascade stays on-canvas with a peek offset.
    expect(added.col).toBeGreaterThanOrEqual(0);
    expect(added.row).toBeGreaterThanOrEqual(0);
    expect(added.col + 3).toBeLessThanOrEqual(BOARD_GRID_COLS);
    expect(added.row + 3).toBeLessThanOrEqual(BOARD_GRID_ROWS);
    expect(added.z).toBeGreaterThan(
      Math.max(...config.widgets.slice(0, -1).map((w) => w.z ?? 0)),
    );
    // Must not land at the off-canvas bottom edge row (= 10).
    expect(added.row).toBeLessThan(BOARD_GRID_ROWS);
  });

  it("findFreePlacement prefers an empty cell when space exists", () => {
    const sparse: BoardConfig = {
      version: BOARD_LAYOUT_VERSION,
      widgets: [{ i: "w-wall", type: "wall", col: 0, row: 0, sizeId: "4x3", z: 1 }],
    };
    const spot = findFreePlacement(sparse.widgets, "wall", "4x3");
    expect(spot).toEqual({ col: 4, row: 0 });
    const next = addWidget(sparse, "wall");
    expect(next.widgets.at(-1)).toMatchObject({ type: "wall", col: 4, row: 0, sizeId: "3x3" });
  });

  it("findFreePlacement cascades on a full mosaic so duplicates stay visible", () => {
    const full = createDefaultBoardConfig();
    const spot = findFreePlacement(full.widgets, "wall", "3x3");
    // Existing wall is at (8,2); cascade peeks at (9,3).
    expect(spot).toEqual({ col: 9, row: 3 });
  });

  it("updateWidgetSizeId clamps to allowed presets", () => {
    let config = createDefaultBoardConfig();
    const map = config.widgets.find((w) => w.type === "map")!;
    config = updateWidgetSizeId(config, map.i, "8x6");
    expect(config.widgets.find((w) => w.i === map.i)!.sizeId).toBe("8x6");
  });

  it("exposes every registry type as addable", () => {
    expect(BOARD_WIDGET_TYPES).toContain("gantt-events");
    expect(BOARD_WIDGET_TYPES).toContain("calendar-day");
    expect(BOARD_WIDGET_TYPES).toContain("weather");
    expect(BOARD_WIDGET_TYPES).toContain("queue");
    expect(BOARD_WIDGET_TYPES).toContain("sources");
  });

  it("resetBoardConfig reseeds mosaic with fresh instance ids", () => {
    const config = createDefaultBoardConfig();
    const map = config.widgets.find((w) => w.type === "map")!;
    const next = updateWidgetSizeId(config, map.i, "8x6");
    expect(next.widgets.find((w) => w.i === map.i)!.sizeId).toBe("8x6");
    const reset = resetBoardConfig();
    expect(reset.widgets.find((w) => w.type === "map")!.i).not.toBe(map.i);
    expect(reset.widgets.find((w) => w.type === "map")!.sizeId).toBe("5x3");
  });

  it("reset clears sparse custom layout", () => {
    let config: BoardConfig = createDefaultBoardConfig();
    config = addWidget(config, "logs");
    expect(config.widgets.length).toBeGreaterThan(createDefaultBoardConfig().widgets.length);
    const reset = resetBoardConfig();
    expect(reset.widgets).toHaveLength(createDefaultBoardConfig().widgets.length);
    expect(reset.widgets.map((w) => w.type)).toEqual(
      expect.arrayContaining(["map", "wall", "weather", "gantt", "gantt-events", "events", "clock", "queue", "sources"]),
    );
  });
});
