/**
 * Unit tests for hierarchical source filter selection.
 */

import { describe, expect, it } from "vitest";

import {
  buildFilterTreeRows,
  parseSourceFilterValue,
  pruneSourceFilter,
  resolveAnalysisTaskIdsFromFilter,
  userEventMatchesSourceSelection,
} from "./sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

describe("sourceFilterSelection", () => {
  it("parses hierarchical shapes; rejects legacy string[]", () => {
    expect(parseSourceFilterValue(null)).toBeNull();
    expect(parseSourceFilterValue(["t1", "__user__"])).toBeNull();
    expect(
      parseSourceFilterValue({ taskIds: ["t1", ""], worksetIds: ["ws-a"] }),
    ).toEqual({ taskIds: ["t1"], worksetIds: ["ws-a"] });
    expect(parseSourceFilterValue({ taskIds: "bad" })).toBeNull();
  });

  it("builds workset-primary tree; omitted worksetId nests under 一般", () => {
    const rows = buildFilterTreeRows(
      [
        { id: SYSTEM_WORKSET_ID, name: "User" },
        { id: "ws-a", name: "Alpha" },
      ],
      [
        { id: "t1", name: "In A", worksetId: "ws-a" },
        { id: "t2", name: "Top", worksetId: null },
      ],
      "Unassigned",
    );
    expect(rows).toEqual([
      {
        kind: "workset",
        id: SYSTEM_WORKSET_ID,
        name: "User",
        children: [{ id: "t2", name: "Top", worksetId: null }],
      },
      {
        kind: "workset",
        id: "ws-a",
        name: "Alpha",
        children: [{ id: "t1", name: "In A", worksetId: "ws-a" }],
      },
    ]);
  });

  it("prunes stale ids but keeps null / empty selections untouched", () => {
    expect(pruneSourceFilter(null, ["a"], ["ws-1"])).toBeNull();
    expect(
      pruneSourceFilter({ taskIds: [], worksetIds: [] }, ["a"], ["ws-1"]),
    ).toEqual({ taskIds: [], worksetIds: [] });
    expect(
      pruneSourceFilter(
        { taskIds: ["a", "gone"], worksetIds: [SYSTEM_WORKSET_ID, "ws-gone"] },
        ["a", "b"],
        [SYSTEM_WORKSET_ID, "ws-1"],
      ),
    ).toEqual({ taskIds: ["a"], worksetIds: [SYSTEM_WORKSET_ID] });
  });

  it("resolves analysis task ids from worksets + explicit tasks", () => {
    const tasks = [
      { id: "t1", worksetId: "ws-a" },
      { id: "t2", worksetId: null },
      { id: "t3", worksetId: "ws-a" },
    ];
    expect(resolveAnalysisTaskIdsFromFilter(null, tasks)).toBeNull();
    expect(
      resolveAnalysisTaskIdsFromFilter({ taskIds: ["t2"], worksetIds: ["ws-a"] }, tasks),
    ).toEqual(["t1", "t2", "t3"]);
  });

  it("matches user_events by ownership workset; provenance only via explicit tasks", () => {
    const allowWorksets = new Set(["ws-A"]);
    // Workset-only selection: expanded members must NOT leak via provenance.
    expect(
      userEventMatchesSourceSelection(
        { worksetId: "ws-B", taskId: "memberOfA" },
        allowWorksets,
        new Set(),
      ),
    ).toBe(false);
    expect(
      userEventMatchesSourceSelection(
        { worksetId: "ws-A", taskId: "memberOfA" },
        allowWorksets,
        new Set(),
      ),
    ).toBe(true);
    // Explicit taskIds may match provenance even across ownership worksets.
    expect(
      userEventMatchesSourceSelection(
        { worksetId: "ws-B", taskId: "memberOfA" },
        new Set(),
        new Set(["memberOfA"]),
      ),
    ).toBe(true);
  });
});
