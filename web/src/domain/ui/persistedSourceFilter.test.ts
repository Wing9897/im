/**
 * Shared persistence core for hierarchical source filters.
 * Timeline / intelligence wrappers only bind a storage key — covered here once.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { INTELLIGENCE_SELECTED_SOURCES_STORAGE_KEY } from "../intelligence/intelligencePersistedKeys";
import {
  loadIntelligenceSelectedSources,
  pruneIntelligenceSelectedSources,
  saveIntelligenceSelectedSources,
} from "../intelligence/intelligenceSourceFilter";
import {
  loadTimelineSelectedSources,
  pruneTimelineSelectedSources,
  saveTimelineSelectedSources,
  TIMELINE_SELECTED_SOURCES_STORAGE_KEY,
} from "../timeline/timelineSourceFilter";
import { makePersistedSourceFilter } from "./persistedSourceFilter";

const CORE_KEY = "test:persisted-source-filter";

describe("makePersistedSourceFilter", () => {
  const persisted = makePersistedSourceFilter(CORE_KEY);

  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to null (all sources)", () => {
    expect(persisted.load()).toBeNull();
  });

  it("persists hierarchical selection", () => {
    persisted.save({ taskIds: ["a"], worksetIds: [SYSTEM_WORKSET_ID] });
    expect(persisted.load()).toEqual({
      taskIds: ["a"],
      worksetIds: [SYSTEM_WORKSET_ID],
    });
  });

  it("preserves explicit empty selection", () => {
    persisted.save({ taskIds: [], worksetIds: [] });
    expect(persisted.load()).toEqual({ taskIds: [], worksetIds: [] });
  });

  it("ignores legacy string[] (hard-cut → all sources)", () => {
    localStorage.setItem(CORE_KEY, JSON.stringify(["a", SYSTEM_WORKSET_ID]));
    expect(persisted.load()).toBeNull();
  });

  it("prunes stale task ids; keeps catalog worksets", () => {
    expect(
      persisted.prune(
        { taskIds: ["a", "gone"], worksetIds: [SYSTEM_WORKSET_ID] },
        ["a", "b"],
        [SYSTEM_WORKSET_ID, "ws-1"],
      ),
    ).toEqual({ taskIds: ["a"], worksetIds: [SYSTEM_WORKSET_ID] });
  });
});

describe("timeline / intelligence key bindings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("timeline uses im:timeline:selected-sources", () => {
    saveTimelineSelectedSources({ taskIds: ["t1"], worksetIds: [] });
    expect(JSON.parse(localStorage.getItem(TIMELINE_SELECTED_SOURCES_STORAGE_KEY)!)).toEqual({
      taskIds: ["t1"],
      worksetIds: [],
    });
    expect(loadTimelineSelectedSources()).toEqual({ taskIds: ["t1"], worksetIds: [] });
    expect(
      pruneTimelineSelectedSources(
        { taskIds: ["t1", "gone"], worksetIds: [SYSTEM_WORKSET_ID] },
        ["t1"],
        [SYSTEM_WORKSET_ID],
      ),
    ).toEqual({ taskIds: ["t1"], worksetIds: [SYSTEM_WORKSET_ID] });
  });

  it("intelligence uses im:intelligence:selected-sources", () => {
    localStorage.setItem(INTELLIGENCE_SELECTED_SOURCES_STORAGE_KEY, JSON.stringify(["legacy"]));
    expect(loadIntelligenceSelectedSources()).toBeNull();
    saveIntelligenceSelectedSources({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] });
    expect(loadIntelligenceSelectedSources()).toEqual({
      taskIds: [],
      worksetIds: [SYSTEM_WORKSET_ID],
    });
    expect(
      pruneIntelligenceSelectedSources({ taskIds: ["gone"], worksetIds: [] }, ["a"]),
    ).toBeNull();
  });
});
