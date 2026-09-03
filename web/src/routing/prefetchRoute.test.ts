import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { prefetchRoute } from "./prefetchRoute";

describe("prefetchRoute", () => {
  it("is idempotent and ignores unknown paths", () => {
    expect(() => prefetchRoute("/no-such-route")).not.toThrow();
    expect(() => prefetchRoute("/monitor")).not.toThrow();
    expect(() => prefetchRoute("/monitor")).not.toThrow();
    expect(() => prefetchRoute("/tasks/abc/edit")).not.toThrow();
    expect(() => prefetchRoute("/worksets")).not.toThrow();
    expect(() => prefetchRoute("/worksets/abc")).not.toThrow();
  });

  it("accepts assistant and voice paths", () => {
    expect(() => prefetchRoute("/assistant")).not.toThrow();
    expect(() => prefetchRoute("/settings/ai/voice")).not.toThrow();
    expect(() => prefetchRoute("/ai/voice")).not.toThrow();
  });

  it("maps /tasks to DashboardViewer", () => {
    const src = readFileSync(resolve(__dirname, "./prefetchRoute.ts"), "utf8");
    expect(src).toContain('"/tasks": () => import("../pages/dashboard/DashboardViewer")');
    expect(src).not.toContain('"/ai/analysis-strategy"');
  });

  it("prefetches agent detail via /agent (not retired /project)", () => {
    expect(() => prefetchRoute("/tasks/abc/agent")).not.toThrow();
  });

  it("prefetches External interfaces", () => {
    expect(() => prefetchRoute("/settings/integrations")).not.toThrow();
  });

  it("prefetches the notifications workspace at /notify", () => {
    expect(() => prefetchRoute("/notify")).not.toThrow();
    expect(() => prefetchRoute("/notify?tab=notify")).not.toThrow();
    expect(() => prefetchRoute("/subscriptions")).not.toThrow();
    expect(() => prefetchRoute("/subscriptions/published")).not.toThrow();
    expect(() => prefetchRoute("/subscriptions/account")).not.toThrow();
    expect(() => prefetchRoute("/subscriptions/search")).not.toThrow();
  });
});
