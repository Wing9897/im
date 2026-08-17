import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSET_CATALOG_TAB,
  isLegacyTasksWorksetPath,
  isWorksetCatalogTab,
  isWorksetsPath,
  parseWorksetCatalogTab,
  parseWorksetGraphFilter,
  worksetDetailPath,
  worksetsCatalogPath,
  WORKSET_GRAPH_FILTER_PARAM,
  WORKSETS_PATH,
} from "./worksetRoutes";

describe("worksetRoutes", () => {
  it("treats /worksets and detail paths as the workset catalog", () => {
    expect(isWorksetsPath(WORKSETS_PATH)).toBe(true);
    expect(isWorksetsPath("/worksets/abc")).toBe(true);
    expect(isWorksetsPath("/tasks")).toBe(false);
    expect(isWorksetsPath("/tasks/worksets/abc")).toBe(false);
  });

  it("builds contents-only detail paths and catalog tab URLs", () => {
    expect(worksetDetailPath("ws-1")).toBe("/worksets/ws-1");
    expect(worksetsCatalogPath()).toBe("/worksets");
    expect(worksetsCatalogPath("catalog")).toBe("/worksets");
    expect(worksetsCatalogPath("graph")).toBe("/worksets?tab=graph");
    expect(worksetsCatalogPath("graph", "ws-1")).toBe("/worksets?tab=graph&worksetId=ws-1");
    expect(WORKSET_GRAPH_FILTER_PARAM).toBe("worksetId");
    expect(parseWorksetGraphFilter(null)).toBeNull();
    expect(parseWorksetGraphFilter("")).toBeNull();
    expect(parseWorksetGraphFilter("ws-1")).toBe("ws-1");
    expect(isLegacyTasksWorksetPath("/tasks/worksets/ws-1")).toBe(true);
    expect(isLegacyTasksWorksetPath("/worksets/ws-1")).toBe(false);
  });

  it("parses catalog tabs with catalog as the default and flow as a graph alias", () => {
    expect(DEFAULT_WORKSET_CATALOG_TAB).toBe("catalog");
    expect(isWorksetCatalogTab("catalog")).toBe(true);
    expect(isWorksetCatalogTab("graph")).toBe(true);
    expect(isWorksetCatalogTab("flow")).toBe(false);
    expect(parseWorksetCatalogTab(null)).toBe("catalog");
    expect(parseWorksetCatalogTab("catalog")).toBe("catalog");
    expect(parseWorksetCatalogTab("graph")).toBe("graph");
    expect(parseWorksetCatalogTab("flow")).toBe("graph");
    expect(parseWorksetCatalogTab("contents")).toBe("catalog");
  });
});
