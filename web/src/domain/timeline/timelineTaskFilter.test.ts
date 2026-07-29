import { beforeEach, describe, expect, it } from "vitest";
import { USER_EVENTS_FILTER_ID } from "./userEvents";
import {
  TIMELINE_SELECTED_TASK_IDS_STORAGE_KEY,
  loadTimelineSelectedTaskIds,
  pruneTimelineSelectedTaskIds,
  saveTimelineSelectedTaskIds,
  timelineFilterCatalogIds,
} from "./timelineTaskFilter";

describe("timelineTaskFilter persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to null (all tasks)", () => {
    expect(loadTimelineSelectedTaskIds()).toBeNull();
  });

  it("round-trips multi-select ids", () => {
    saveTimelineSelectedTaskIds(["a", USER_EVENTS_FILTER_ID]);
    expect(loadTimelineSelectedTaskIds()).toEqual(["a", USER_EVENTS_FILTER_ID]);
  });

  it("preserves persisted empty array as show none", () => {
    localStorage.setItem(TIMELINE_SELECTED_TASK_IDS_STORAGE_KEY, JSON.stringify([]));
    expect(loadTimelineSelectedTaskIds()).toEqual([]);
  });

  it("prunes stale ids but keeps __user__ when still in catalog", () => {
    const catalog = timelineFilterCatalogIds(["a", "b"]);
    expect(pruneTimelineSelectedTaskIds(["a", "gone", USER_EVENTS_FILTER_ID], catalog)).toEqual([
      "a",
      USER_EVENTS_FILTER_ID,
    ]);
    expect(pruneTimelineSelectedTaskIds(["a", "b", USER_EVENTS_FILTER_ID], catalog)).toBeNull();
    expect(pruneTimelineSelectedTaskIds(["a"], [])).toEqual(["a"]);
    expect(pruneTimelineSelectedTaskIds(["gone"], catalog)).toBeNull();
    expect(pruneTimelineSelectedTaskIds([], catalog)).toEqual([]);
  });
});
