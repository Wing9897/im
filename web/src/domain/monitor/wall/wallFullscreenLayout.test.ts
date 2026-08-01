import { describe, expect, it } from "vitest";

import { wallFullscreenGrid } from "./wallFullscreenLayout";

describe("wallFullscreenGrid", () => {
  it("fits eight cards in a 4x2 landscape grid", () => {
    expect(wallFullscreenGrid(8)).toEqual({ cols: 4, rows: 2 });
  });

  it.each([
    [0, { cols: 1, rows: 1 }],
    [1, { cols: 1, rows: 1 }],
    [2, { cols: 2, rows: 1 }],
    [4, { cols: 2, rows: 2 }],
    [6, { cols: 3, rows: 2 }],
    [9, { cols: 3, rows: 3 }],
    [12, { cols: 4, rows: 3 }],
  ] as const)("maps %i cards to %j", (count, expected) => {
    expect(wallFullscreenGrid(count)).toEqual(expected);
  });
});
