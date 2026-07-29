import { beforeEach, describe, expect, it } from "vitest";
import { INTELLIGENCE_SELECTED_TASK_IDS_STORAGE_KEY } from "./intelligencePersistedKeys";
import {
  loadIntelligenceSelectedTaskIds,
  pruneIntelligenceSelectedTaskIds,
  saveIntelligenceSelectedTaskIds,
} from "./intelligenceTaskFilter";

describe("intelligenceTaskFilter persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to null (all tasks)", () => {
    expect(loadIntelligenceSelectedTaskIds()).toBeNull();
  });

  it("treats persisted empty array as all (null)", () => {
    localStorage.setItem(INTELLIGENCE_SELECTED_TASK_IDS_STORAGE_KEY, JSON.stringify([]));
    expect(loadIntelligenceSelectedTaskIds()).toBeNull();
  });

  it("round-trips multi-select ids", () => {
    saveIntelligenceSelectedTaskIds(["a", "b"]);
    expect(loadIntelligenceSelectedTaskIds()).toEqual(["a", "b"]);
    expect(localStorage.getItem(INTELLIGENCE_SELECTED_TASK_IDS_STORAGE_KEY)).toBe(
      JSON.stringify(["a", "b"]),
    );
  });

  it("prunes stale catalog ids", () => {
    expect(pruneIntelligenceSelectedTaskIds(["a", "gone"], ["a", "b"])).toEqual(["a"]);
    expect(pruneIntelligenceSelectedTaskIds(["a", "b"], ["a", "b"])).toBeNull();
    expect(pruneIntelligenceSelectedTaskIds(null, ["a"])).toBeNull();
    expect(pruneIntelligenceSelectedTaskIds(["gone"], ["a", "b"])).toBeNull();
  });

  it("keeps intentional empty selection when catalog is live", () => {
    expect(pruneIntelligenceSelectedTaskIds([], ["a", "b"])).toEqual([]);
  });

  it("does not clear selection when catalog is still empty", () => {
    expect(pruneIntelligenceSelectedTaskIds(["task-1"], [])).toEqual(["task-1"]);
  });
});
