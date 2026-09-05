/**
 * Leftover `/worksets?tab=tasks` stays on the catalog — `/tasks` is independent.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Workset catalog leftover ?tab=tasks", () => {
  it("does not redirect /worksets?tab=tasks to /tasks", () => {
    const src = readFileSync(resolve(__dirname, "./AppRoutes.tsx"), "utf8");
    expect(src).toContain('path="/worksets"');
    expect(src).toContain("DashboardViewer");
    expect(src).not.toContain("WorksetCatalogRoute");
    expect(src).not.toContain("worksetTasksBookmarkPath");
    expect(src).not.toContain("<Navigate to=\"/tasks?scheduling=open\" replace />");
  });
});
