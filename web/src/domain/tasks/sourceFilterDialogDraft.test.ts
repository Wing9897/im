/**
 * Unit tests for source-filter dialog draft toggles + search filtering.
 */

import { describe, expect, it } from "vitest";

import {
  collapseSourceFilterDraft,
  filterSourceFilterTreeRows,
  matchesSourceFilterQuery,
  resolveCheckedTasks,
  resolveGroupCheckState,
  sameSourceFilterSelection,
  toggleTaskInDraft,
  toggleWorksetInDraft,
  visibleChildrenForSourceFilterRow,
  type SourceFilterDraftContext,
} from "./sourceFilterDialogDraft";
import {
  buildFilterTreeRows,
  UNASSIGNED_FILTER_GROUP_ID,
  type WorksetMemberTask,
} from "./sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

const MEMBER_TASKS: WorksetMemberTask[] = [
  { id: "t1", name: "Alpha", worksetId: "ws-1" },
  { id: "t2", name: "Beta", worksetId: "ws-1" },
  { id: "t3", name: "Gamma", worksetId: null },
  { id: "t4", name: "Delta", worksetId: null },
];

const CTX: SourceFilterDraftContext = {
  allWorksetIds: [SYSTEM_WORKSET_ID, "ws-1"],
  unassignedTaskIds: ["t3", "t4"],
  memberTasks: MEMBER_TASKS,
};

describe("sourceFilterDialogDraft", () => {
  describe("collapseSourceFilterDraft", () => {
    it("collapses full worksets + all unassigned to null", () => {
      expect(
        collapseSourceFilterDraft(
          {
            taskIds: ["t3", "t4"],
            worksetIds: [SYSTEM_WORKSET_ID, "ws-1"],
          },
          CTX,
        ),
      ).toBeNull();
    });

    it("keeps explicit empty selection", () => {
      expect(collapseSourceFilterDraft({ taskIds: [], worksetIds: [] }, CTX)).toEqual({
        taskIds: [],
        worksetIds: [],
      });
    });

    it("does not collapse when unassigned remain unchecked", () => {
      expect(
        collapseSourceFilterDraft(
          { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID, "ws-1"] },
          CTX,
        ),
      ).toEqual({
        taskIds: [],
        worksetIds: [SYSTEM_WORKSET_ID, "ws-1"].sort(),
      });
    });
  });

  describe("toggleWorksetInDraft", () => {
    it("deselects one workset from all-sources without dropping unassigned", () => {
      expect(toggleWorksetInDraft(null, "ws-1", CTX)).toEqual({
        taskIds: ["t3", "t4"],
        worksetIds: [SYSTEM_WORKSET_ID],
      });
    });

    it("deselects unassigned group from all-sources", () => {
      expect(toggleWorksetInDraft(null, UNASSIGNED_FILTER_GROUP_ID, CTX)).toEqual({
        taskIds: [],
        worksetIds: [SYSTEM_WORKSET_ID, "ws-1"].sort(),
      });
    });

    it("selecting a workset strips redundant member taskIds", () => {
      const next = toggleWorksetInDraft(
        { taskIds: ["t1", "t3"], worksetIds: [] },
        "ws-1",
        CTX,
      );
      expect(next).toEqual({
        taskIds: ["t3"],
        worksetIds: ["ws-1"],
      });
    });

    it("deselecting a workset clears implied members (task-only must re-check)", () => {
      expect(
        toggleWorksetInDraft({ taskIds: [], worksetIds: ["ws-1"] }, "ws-1", CTX),
      ).toEqual({ taskIds: [], worksetIds: [] });
    });

    it("toggles all unassigned on/off without touching worksets", () => {
      const on = toggleWorksetInDraft(
        { taskIds: [], worksetIds: ["ws-1"] },
        UNASSIGNED_FILTER_GROUP_ID,
        CTX,
      );
      expect(on).toEqual({ taskIds: ["t3", "t4"], worksetIds: ["ws-1"] });
      const off = toggleWorksetInDraft(on, UNASSIGNED_FILTER_GROUP_ID, CTX);
      expect(off).toEqual({ taskIds: [], worksetIds: ["ws-1"] });
    });
  });

  describe("toggleTaskInDraft", () => {
    it("splits a selected workset when unchecking one member", () => {
      const next = toggleTaskInDraft(
        { taskIds: [], worksetIds: ["ws-1"] },
        "t1",
        CTX,
      );
      expect(next).toEqual({
        taskIds: ["t2"],
        worksetIds: [],
      });
    });

    it("unchecking a member from all-sources keeps siblings + unassigned", () => {
      expect(toggleTaskInDraft(null, "t1", CTX)).toEqual({
        taskIds: ["t2", "t3", "t4"].sort(),
        worksetIds: [SYSTEM_WORKSET_ID],
      });
    });

    it("task-only select does not auto-promote parent workset", () => {
      let draft = toggleTaskInDraft({ taskIds: [], worksetIds: [] }, "t1", CTX);
      draft = toggleTaskInDraft(draft, "t2", CTX);
      // All members checked via taskIds — still no workset (items stay hidden).
      expect(draft).toEqual({ taskIds: ["t1", "t2"], worksetIds: [] });
      expect(resolveCheckedTasks(draft, MEMBER_TASKS).has("t1")).toBe(true);
      expect(resolveCheckedTasks(draft, MEMBER_TASKS).has("t2")).toBe(true);
      expect(resolveGroupCheckState({
        kind: "workset",
        worksetSelected: false,
        childIds: ["t1", "t2"],
        checkedTasks: resolveCheckedTasks(draft, MEMBER_TASKS),
        allSourcesSelected: false,
      })).toBe("indeterminate");
    });

    it("re-checking the missing sibling after a split stays task-only until workset toggle", () => {
      let draft = toggleTaskInDraft(
        { taskIds: [], worksetIds: ["ws-1"] },
        "t1",
        CTX,
      );
      expect(draft).toEqual({ taskIds: ["t2"], worksetIds: [] });
      draft = toggleTaskInDraft(draft, "t1", CTX);
      expect(draft).toEqual({ taskIds: ["t1", "t2"], worksetIds: [] });
      draft = toggleWorksetInDraft(draft, "ws-1", CTX);
      expect(draft).toEqual({ taskIds: [], worksetIds: ["ws-1"] });
    });
  });

  describe("resolveGroupCheckState", () => {
    it("marks workset checked only when workset id is selected", () => {
      expect(
        resolveGroupCheckState({
          kind: "workset",
          worksetSelected: true,
          childIds: ["t1", "t2"],
          checkedTasks: new Set(["t1", "t2"]),
          allSourcesSelected: false,
        }),
      ).toBe("checked");
    });

    it("marks unassigned indeterminate for partial selection", () => {
      expect(
        resolveGroupCheckState({
          kind: "unassigned",
          worksetSelected: false,
          childIds: ["t3", "t4"],
          checkedTasks: new Set(["t3"]),
          allSourcesSelected: false,
        }),
      ).toBe("indeterminate");
    });
  });

  describe("filterSourceFilterTreeRows", () => {
    const rows = buildFilterTreeRows(
      [
        { id: SYSTEM_WORKSET_ID, name: "General" },
        { id: "ws-1", name: "Ops" },
      ],
      MEMBER_TASKS,
      "Unassigned",
    );

    it("keeps full children on the row when the parent workset name matches", () => {
      const filtered = filterSourceFilterTreeRows(rows, "Ops", (c) => c.name ?? c.id);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe("ws-1");
      expect(filtered[0]?.children.map((c) => c.id)).toEqual(["t1", "t2"]);
    });

    it("keeps the parent row (full children) when only a child title matches", () => {
      const filtered = filterSourceFilterTreeRows(rows, "Alpha", (c) => c.name ?? c.id);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.children.map((c) => c.id)).toEqual(["t1", "t2"]);
    });

    it("narrows rendered children only via visibleChildrenForSourceFilterRow", () => {
      const row = rows.find((r) => r.id === "ws-1")!;
      expect(
        visibleChildrenForSourceFilterRow(row, "Ops", (c) => c.name ?? c.id).map((c) => c.id),
      ).toEqual(["t1", "t2"]);
      expect(
        visibleChildrenForSourceFilterRow(row, "Alpha", (c) => c.name ?? c.id).map((c) => c.id),
      ).toEqual(["t1"]);
    });

    it("matchesSourceFilterQuery is case-insensitive", () => {
      expect(matchesSourceFilterQuery("Alpha briefing", "alpha")).toBe(true);
      expect(matchesSourceFilterQuery("Alpha", "zzz")).toBe(false);
    });
  });

  describe("sameSourceFilterSelection", () => {
    it("ignores id order", () => {
      expect(
        sameSourceFilterSelection(
          { taskIds: ["a", "b"], worksetIds: ["w2", "w1"] },
          { taskIds: ["b", "a"], worksetIds: ["w1", "w2"] },
        ),
      ).toBe(true);
    });
  });
});
