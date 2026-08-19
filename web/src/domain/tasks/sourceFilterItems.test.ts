import { describe, expect, it } from "vitest";
import {
  filterItemsBySourceSelection,
  resolveSpanWorksetId,
} from "./sourceFilterItems";

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
      taskId: null as string | null,
      sourceKind: "workset",
      worksetId: "__general__",
    },
    {
      taskId: null as string | null,
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
      { taskIds: [], worksetIds: ["__general__", "ws-1"] },
      new Set(),
    );
    expect(filtered.map((s) => s.worksetId ?? s.taskId)).toEqual([
      "ws-1",
      "__general__",
      "ws-1",
    ]);
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

  it("does not match user_event provenance via expanded workset member tasks", () => {
    const items = [
      {
        id: "ue-cross",
        source: "user",
        taskId: "memberOfA",
        worksetId: "ws-B",
      },
      {
        id: "ue-owned-a",
        source: "user",
        taskId: null as string | null,
        worksetId: "ws-A",
      },
      {
        id: "analysis-a",
        source: "analysis" as const,
        taskId: "memberOfA",
        worksetId: null as string | null,
      },
    ];
    // Selecting workset A expands memberOfA for analysis, but must not pull
    // a B-owned user_event that only shares provenance taskId.
    const filtered = filterItemsBySourceSelection(
      items,
      { taskIds: [], worksetIds: ["ws-A"] },
      new Set(["memberOfA"]),
    );
    expect(filtered.map((item) => item.id)).toEqual(["ue-owned-a", "analysis-a"]);
  });

  it("matches user_event provenance only for explicitly selected taskIds", () => {
    const items = [
      {
        id: "ue-tagged",
        source: "user",
        taskId: "memberOfA",
        worksetId: "ws-B",
      },
    ];
    const filtered = filterItemsBySourceSelection(
      items,
      { taskIds: ["memberOfA"], worksetIds: [] },
      new Set(["memberOfA"]),
    );
    expect(filtered.map((item) => item.id)).toEqual(["ue-tagged"]);
  });

  it("keeps RRULE rows when worksetId matches (not taskId provenance)", () => {
    const items = [
      {
        id: "rrule-a",
        source: "recurring",
        seriesId: "series-a",
        taskId: null as string | null,
        worksetId: "ws-A",
      },
      {
        id: "rrule-b",
        source: "recurring",
        seriesId: "series-b",
        taskId: null as string | null,
        worksetId: "ws-B",
      },
    ];
    const filtered = filterItemsBySourceSelection(
      items,
      { taskIds: [], worksetIds: ["ws-A"] },
      new Set(["memberOfA"]),
    );
    expect(filtered.map((item) => item.id)).toEqual(["rrule-a"]);
  });

  it("matches item_remind by workset ownership (default __general__)", () => {
    const items = [
      {
        id: "item-user",
        source: "item_remind",
        worksetId: null as string | null,
      },
      {
        id: "item-a",
        source: "item_remind",
        worksetId: "ws-A",
      },
    ];
    expect(
      filterItemsBySourceSelection(
        items,
        { taskIds: [], worksetIds: ["__general__"] },
        new Set(),
      ).map((item) => item.id),
    ).toEqual(["item-user"]);
    expect(
      filterItemsBySourceSelection(
        items,
        { taskIds: [], worksetIds: ["ws-A"] },
        new Set(),
      ).map((item) => item.id),
    ).toEqual(["item-a"]);
  });
});
