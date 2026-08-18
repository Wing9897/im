import { describe, expect, it } from "vitest";

import { PIPELINE_MAX_VISIBLE_WORKSETS } from "./pipelineConstants";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  defaultGraphWorksetIds,
  graphWorksetIdSetEquals,
  resolveGraphWorksetIds,
  selectAllGraphWorksetIds,
  clearGraphWorksetIds,
  toggleGraphWorksetId,
} from "./worksetGraphFilter";

function row(id: string, updatedAt = ""): { id: string; updatedAt: string } {
  return { id, updatedAt };
}

describe("worksetGraphFilter", () => {
  it("defaults to every workset when the household is within the cap", () => {
    const worksets = [row(SYSTEM_WORKSET_ID), row("ws-1"), row("ws-2")];
    expect(defaultGraphWorksetIds(worksets)).toEqual([SYSTEM_WORKSET_ID, "ws-1", "ws-2"]);
    expect(PIPELINE_MAX_VISIBLE_WORKSETS).toBe(10);
  });

  it("defaults to 一般 plus the newest worksets when more than 10 exist", () => {
    const worksets = [
      row(SYSTEM_WORKSET_ID, "2020-01-01T00:00:00Z"),
      ...Array.from({ length: 10 }, (_, index) =>
        row(`ws-${index + 1}`, `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
      ),
    ];
    expect(worksets).toHaveLength(11);
    expect(defaultGraphWorksetIds(worksets)).toEqual([
      SYSTEM_WORKSET_ID,
      "ws-2",
      "ws-3",
      "ws-4",
      "ws-5",
      "ws-6",
      "ws-7",
      "ws-8",
      "ws-9",
      "ws-10",
    ]);
  });

  it("resolves a missing query to the default set and keeps catalog order for known ids", () => {
    const worksets = [row(SYSTEM_WORKSET_ID), row("ws-1"), row("ws-2")];
    expect(resolveGraphWorksetIds(null, worksets)).toEqual([SYSTEM_WORKSET_ID, "ws-1", "ws-2"]);
    expect(resolveGraphWorksetIds(["ws-2", "missing", "ws-2", SYSTEM_WORKSET_ID], worksets)).toEqual([
      SYSTEM_WORKSET_ID,
      "ws-2",
    ]);
    expect(resolveGraphWorksetIds(["gone"], worksets)).toEqual([SYSTEM_WORKSET_ID, "ws-1", "ws-2"]);
  });

  it("keeps a long explicit query (全選) instead of capping at 10", () => {
    const worksets = Array.from({ length: 12 }, (_, index) => row(`ws-${index + 1}`));
    const parsed = worksets.map((item) => item.id);
    expect(resolveGraphWorksetIds(parsed, worksets)).toEqual(parsed);
    expect(selectAllGraphWorksetIds(worksets)).toEqual(parsed);
    expect(clearGraphWorksetIds()).toEqual([]);
    expect(resolveGraphWorksetIds([], worksets)).toEqual([]);
  });

  it("refuses a new check at the cap and allows unchecking 一般", () => {
    const worksets = Array.from({ length: 11 }, (_, index) => row(index === 0 ? SYSTEM_WORKSET_ID : `ws-${index}`));
    const selected = defaultGraphWorksetIds(worksets);
    expect(selected).toHaveLength(10);
    expect(selected).toContain(SYSTEM_WORKSET_ID);
    const excluded = worksets.map((item) => item.id).find((id) => !selected.includes(id));
    expect(excluded).toBeTruthy();
    expect(toggleGraphWorksetId(selected, excluded as string, worksets)).toEqual(selected);
    expect(toggleGraphWorksetId(selected, SYSTEM_WORKSET_ID, worksets)).not.toContain(SYSTEM_WORKSET_ID);
    expect(graphWorksetIdSetEquals(selected, defaultGraphWorksetIds(worksets))).toBe(true);
    expect(selectAllGraphWorksetIds(worksets)).toHaveLength(11);
    expect(selectAllGraphWorksetIds(worksets)).toContain(excluded);
  });
});
