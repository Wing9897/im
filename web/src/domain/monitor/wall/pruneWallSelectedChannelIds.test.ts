import { describe, expect, it } from "vitest";

import { pruneWallSelectedChannelIds } from "./pruneWallSelectedChannelIds";

describe("pruneWallSelectedChannelIds", () => {
  it("returns null when every selection is still known", () => {
    const known = new Set(["telegram:a", "telegram:b"]);
    expect(pruneWallSelectedChannelIds(["telegram:a", "telegram:b"], known)).toBeNull();
  });

  it("drops unknown ids and preserves order of survivors", () => {
    const known = new Set(["telegram:b"]);
    expect(pruneWallSelectedChannelIds(["telegram:a", "telegram:b", "telegram:c"], known)).toEqual([
      "telegram:b",
    ]);
  });

  it("clears the selection when the catalog is empty", () => {
    expect(pruneWallSelectedChannelIds(["telegram:a", "telegram:b"], new Set())).toEqual([]);
  });
});
