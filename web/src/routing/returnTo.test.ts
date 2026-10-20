import { describe, expect, it } from "vitest";

import { isSafeReturnTo, readReturnTo, withReturnTo } from "./returnTo";

describe("isSafeReturnTo", () => {
  it("accepts in-app paths including query and hash", () => {
    expect(isSafeReturnTo("/timeline")).toBe(true);
    expect(isSafeReturnTo("/items/abc/edit")).toBe(true);
    expect(isSafeReturnTo("/timeline?workset=list")).toBe(true);
    expect(isSafeReturnTo("/timeline?sheet=schedule&tab=mine")).toBe(true);
    expect(isSafeReturnTo("/intelligence#top")).toBe(true);
  });

  it("rejects off-site and protocol-relative values", () => {
    expect(isSafeReturnTo("")).toBe(false);
    expect(isSafeReturnTo("timeline")).toBe(false);
    expect(isSafeReturnTo("//evil.example")).toBe(false);
    expect(isSafeReturnTo("https://evil.example")).toBe(false);
    expect(isSafeReturnTo("/\\evil.example")).toBe(false);
    expect(isSafeReturnTo("javascript:alert(1)")).toBe(false);
  });
});

describe("readReturnTo", () => {
  it("returns a safe query value", () => {
    expect(readReturnTo("?returnTo=%2Ftimeline", "/tasks")).toBe("/timeline");
    expect(readReturnTo("returnTo=/items&categoryId=food", "/tasks")).toBe("/items");
  });

  it("normalizes legacy returnTo paths", () => {
    expect(readReturnTo("?returnTo=%2Fschedule", "/tasks")).toBe("/timeline?sheet=schedule");
    expect(readReturnTo("?returnTo=%2Fsubscriptions", "/tasks")).toBe(
      "/timeline?sheet=subscriptions&tab=mine",
    );
    expect(readReturnTo("?returnTo=%2Fworksets", "/tasks")).toBe("/timeline?workset=list");
    expect(readReturnTo("?returnTo=%2Fleaderboard", "/tasks")).toBe("/intelligence?tab=topics");
  });

  it("falls back when missing or unsafe", () => {
    expect(readReturnTo("", "/tasks")).toBe("/tasks");
    expect(readReturnTo("?categoryId=food", "/items")).toBe("/items");
    expect(readReturnTo("?returnTo=//evil.example", "/tasks")).toBe("/tasks");
    expect(readReturnTo("?returnTo=https%3A%2F%2Fevil.example", "/tasks")).toBe("/tasks");
  });
});

describe("withReturnTo", () => {
  it("appends returnTo and keeps existing query", () => {
    expect(withReturnTo("/tasks/new", "/timeline")).toBe("/tasks/new?returnTo=%2Ftimeline");
    expect(withReturnTo("/items/new?worksetId=ws-1", "/timeline")).toBe(
      "/items/new?worksetId=ws-1&returnTo=%2Ftimeline",
    );
    expect(withReturnTo("/tasks/new#section", "/items")).toBe(
      "/tasks/new?returnTo=%2Fitems#section",
    );
  });

  it("leaves the path unchanged when back is unsafe", () => {
    expect(withReturnTo("/tasks/new", "//evil.example")).toBe("/tasks/new");
    expect(withReturnTo("/tasks/new?preset=key-insights", "https://evil.example")).toBe(
      "/tasks/new?preset=key-insights",
    );
  });
});
