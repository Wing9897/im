import { describe, expect, it } from "vitest";
import { pruneMultiSelectIds } from "./pruneMultiSelectIds";

describe("pruneMultiSelectIds", () => {
  it("keeps null (all) and empty-catalog selections", () => {
    expect(pruneMultiSelectIds(null, ["a"])).toBeNull();
    expect(pruneMultiSelectIds(["a"], [])).toEqual(["a"]);
  });

  it("drops stale ids and collapses full cover to null", () => {
    expect(pruneMultiSelectIds(["a", "gone"], ["a", "b"])).toEqual(["a"]);
    expect(pruneMultiSelectIds(["a", "b"], ["a", "b"])).toBeNull();
    expect(pruneMultiSelectIds(["gone"], ["a", "b"])).toBeNull();
  });

  it("keeps intentional empty selection", () => {
    expect(pruneMultiSelectIds([], ["a", "b"])).toEqual([]);
  });
});
