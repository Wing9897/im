import { describe, expect, it } from "vitest";
import {
  filterItemsBySourceSelection,
  resolveSpanWorksetId,
} from "./useBoardSourceFilter";

describe("resolveSpanWorksetId", () => {
  it("returns wire worksetId on workset spans", () => {
    expect(
      resolveSpanWorksetId({
        sourceKind: "workset",
        worksetId: "ws-1",
      }),
    ).toBe("ws-1");
  });

  it("returns null when sourceKind=workset but worksetId missing", () => {
    expect(
      resolveSpanWorksetId({
        sourceKind: "workset",
        worksetId: null,
      }),
    ).toBeNull();
  });

  it("returns null for task rows even when worksetId is present", () => {
    expect(
      resolveSpanWorksetId({
        sourceKind: "task",
        worksetId: "ws-1",
      }),
    ).toBeNull();
  });
});

describe("filterItemsBySourceSelection", () => {
  const spans = [
    { taskId: "t1", sourceKind: "task", worksetId: null as string | null },
    { taskId: "t2", sourceKind: "task", worksetId: "ws-1" },
    {
      taskId: "__user__",
      sourceKind: "workset",
      worksetId: "__user__",
    },
    {
      taskId: "ws-1",
      sourceKind: "workset",
      worksetId: "ws-1",
    },
  ];

  it("returns all items when selection is null", () => {
    expect(filterItemsBySourceSelection(spans, null, null)).toEqual(spans);
  });

  it("returns empty when selection is empty", () => {
    expect(
      filterItemsBySourceSelection(spans, { taskIds: [], worksetIds: [] }, new Set()),
    ).toEqual([]);
  });

  it("matches workset ownership spans via worksetId + sourceKind", () => {
    const filtered = filterItemsBySourceSelection(
      spans,
      { taskIds: [], worksetIds: ["__user__", "ws-1"] },
      new Set(),
    );
    expect(filtered.map((s) => s.taskId)).toEqual(["t2", "__user__", "ws-1"]);
  });

  it("matches analysis task rows by taskId", () => {
    const filtered = filterItemsBySourceSelection(
      spans,
      { taskIds: ["t1"], worksetIds: [] },
      new Set(["t1"]),
    );
    expect(filtered.map((s) => s.taskId)).toEqual(["t1"]);
  });

  it("excludes workset rows missing worksetId (no taskId fallback)", () => {
    const legacy = [
      { taskId: "ws-legacy", sourceKind: "workset", worksetId: null as string | null },
    ];
    const filtered = filterItemsBySourceSelection(
      legacy,
      { taskIds: [], worksetIds: ["ws-legacy"] },
      new Set(),
    );
    expect(filtered).toHaveLength(0);
  });
});
