/**
 * `/worksets?tab=tasks` opens the workset drawer and does not become the tasks page.
 * `/worksets?tab=graph` opens the tasks graph tab.
 */
import { describe, expect, it } from "vitest";

import { applyLegacyRedirect } from "./legacyPaths";

describe("Workset catalog leftover ?tab=tasks", () => {
  it("does not redirect /worksets?tab=tasks to /tasks", () => {
    expect(applyLegacyRedirect("/worksets", "?tab=tasks")).toBe(
      "/timeline?workset=list&tab=tasks",
    );
    expect(applyLegacyRedirect("/worksets", "?tab=graph")).toBe("/tasks?tab=graph");
    expect(applyLegacyRedirect("/worksets", "")).toBe("/timeline?workset=list");
  });
});
