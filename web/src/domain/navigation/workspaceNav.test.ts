import { describe, expect, it } from "vitest";
import { aiWorkspaceNavItems, settingsWorkspaceNavItems, subscriptionsWorkspaceNavItems } from "./workspaceNav";

describe("settingsWorkspaceNavItems", () => {
  it("keeps a single chrome bar: External interfaces is one category, not four nav rows", () => {
    expect(settingsWorkspaceNavItems.map((item) => item.to)).toEqual([
      "/settings/general",
      "/settings/theme",
      "/settings/data",
      "/settings/integrations",
      "/settings/logs",
    ]);
    expect(settingsWorkspaceNavItems.map((item) => item.labelKey)).toEqual([
      "tabs.general",
      "tabs.theme",
      "tabs.data",
      "tabs.integrations",
      "tabs.logs",
    ]);
    expect(settingsWorkspaceNavItems).toHaveLength(5);
    expect(settingsWorkspaceNavItems.some((item) => item.to === "/settings/api")).toBe(false);
    expect(settingsWorkspaceNavItems.some((item) => item.to === "/settings/mcp")).toBe(false);
    expect(
      settingsWorkspaceNavItems.some((item) =>
        /webhook|a2a|deeplink|mcp/i.test(item.to),
      ),
    ).toBe(false);
  });
});

describe("aiWorkspaceNavItems", () => {
  it("keeps provider / voice / staff", () => {
    expect(aiWorkspaceNavItems.map((item) => item.to)).toEqual([
      "/settings/ai/provider",
      "/settings/ai/voice",
      "/settings/ai/staff",
    ]);
  });
});

describe("subscriptionsWorkspaceNavItems", () => {
  it("keeps mine / published / account / search with search last", () => {
    expect(subscriptionsWorkspaceNavItems.map((item) => item.to)).toEqual([
      "/subscriptions/mine",
      "/subscriptions/published",
      "/subscriptions/account",
      "/subscriptions/search",
    ]);
    expect(subscriptionsWorkspaceNavItems.map((item) => item.labelKey)).toEqual([
      "tabs.mine",
      "tabs.published",
      "tabs.account",
      "tabs.search",
    ]);
  });
});
