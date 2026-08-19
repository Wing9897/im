import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKSET_CATALOG_TAB,
  isWorksetCatalogTab,
  isWorksetsPath,
  parseWorksetCatalogTab,
  parseWorksetGraphFilter,
  serializeWorksetGraphFilter,
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
    expect(parseWorksetGraphFilter("__none__")).toEqual([]);
    expect(serializeWorksetGraphFilter([])).toBe("__none__");
    expect(worksetsCatalogPath("graph", [])).toBe("/worksets?tab=graph&worksetId=__none__");
    expect(parseWorksetGraphFilter("ws-1")).toEqual(["ws-1"]);
    expect(parseWorksetGraphFilter("ws-1,__general__")).toEqual(["ws-1", "__general__"]);
    const multi = worksetsCatalogPath("graph", ["ws-1", "__general__"]);
    expect(parseWorksetGraphFilter(new URL(multi, "https://app.local").searchParams.get("worksetId"))).toEqual([
      "ws-1",
      "__general__",
    ]);
  });

  it("does not keep the retired /tasks/worksets helper", () => {
    const src = readFileSync(resolve(__dirname, "./worksetRoutes.ts"), "utf8");
    expect(src).not.toContain("isLegacyTasksWorksetPath");
    expect(src).not.toContain("/tasks/worksets/");
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
