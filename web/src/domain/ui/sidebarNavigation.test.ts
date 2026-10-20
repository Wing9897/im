import { describe, expect, it } from "vitest";
import { applyLegacyRedirect, requireLegacyDestination } from "../../routing/legacyPaths";
import { resolveAppDestinationHref } from "../navigation/appDestinations";
import {
  MAIN_SIDEBAR_PREFETCH_PATHS,
  SIDEBAR_MAIN_GROUPS,
  isSidebarItemActive,
  visibleSidebarGroups,
} from "./sidebarNavigation";

function hrefs(simpleMode: boolean): string[] {
  return visibleSidebarGroups(simpleMode).flatMap((group) => group.items.map((item) => item.to));
}

describe("visibleSidebarGroups", () => {
  it("keeps the full nav including Tasks when simple mode is off", () => {
    const full = hrefs(false);
    expect(full).toEqual(SIDEBAR_MAIN_GROUPS.flatMap((group) => group.items.map((item) => item.to)));
    expect(full).toContain("/tasks");
    expect(full).not.toContain("/sources");
    expect(full).not.toContain("/worksets");
    expect(full).not.toContain("/schedule");
    expect(full).not.toContain("/subscriptions");
    expect(full).toContain("/monitor");
  });

  it("hides collect/analyze entries in simple mode but keeps worksets", () => {
    const simple = hrefs(true);
    expect(simple).toEqual(["/timeline", "/items", "/notify", "/assistant"]);
    expect(simple).not.toContain("/tasks");
    expect(simple).not.toContain("/monitor");
    expect(simple).not.toContain("/sources");
    expect(simple).not.toContain("/leaderboard");
    expect(simple).not.toContain("/intelligence");
  });

  it("keeps the full main sidebar hrefs in product order", () => {
    expect(hrefs(false)).toEqual([
      "/timeline",
      "/intelligence",
      "/items",
      "/tasks",
      "/notify",
      "/monitor",
      "/assistant",
    ]);
  });

  it("prefetches those same main sidebar hrefs", () => {
    expect([...MAIN_SIDEBAR_PREFETCH_PATHS]).toEqual(hrefs(false));
  });

  it("resolves retired destinations through legacyPaths", () => {
    expect(resolveAppDestinationHref("/leaderboard")).toBe(requireLegacyDestination("/leaderboard"));
    expect(resolveAppDestinationHref("/schedule")).toBe(requireLegacyDestination("/schedule"));
    expect(resolveAppDestinationHref("/subscriptions/mine")).toBe(
      requireLegacyDestination("/subscriptions/mine"),
    );
    expect(resolveAppDestinationHref("/worksets")).toBe(requireLegacyDestination("/worksets"));
    expect(resolveAppDestinationHref("/worksets?tab=graph")).toBe(
      applyLegacyRedirect("/worksets", "?tab=graph"),
    );
    expect(applyLegacyRedirect("/worksets", "?tab=graph")).toBe("/tasks?tab=graph");
  });

  it("drops empty intelligence group in simple mode", () => {
    const groups = visibleSidebarGroups(true);
    expect(groups.some((group) => group.labelKey === "groupIntelligence")).toBe(false);
    expect(groups.some((group) => group.labelKey === "groupTime")).toBe(true);
    expect(groups.some((group) => group.labelKey === "groupManage")).toBe(true);
  });
});

describe("isSidebarItemActive", () => {
  const worksets = { to: "/worksets", labelKey: "worksets", icon: "worksets" as const, activePrefix: "/worksets" };
  const tasks = {
    to: "/tasks",
    labelKey: "tasksAndSources",
    icon: "tasks" as const,
    activePrefixes: ["/tasks", "/sources"],
  };
  const settings = { to: "/settings", labelKey: "systemSettings", icon: "settings" as const, activePrefix: "/settings" };
  const ai = { to: "/settings/ai/provider", labelKey: "aiSettings", icon: "ai" as const, activePrefix: "/settings/ai" };
  const items = { to: "/items", labelKey: "items", icon: "items" as const, activePrefix: "/items" };
  const account = { to: "/account/identity", labelKey: "account", icon: "account" as const, activePrefix: "/account" };

  it("does not light 專區 on task editor paths", () => {
    expect(isSidebarItemActive(worksets, "/worksets")).toBe(true);
    expect(isSidebarItemActive(worksets, "/worksets/ws-1")).toBe(true);
    expect(isSidebarItemActive(worksets, "/tasks/abc/edit")).toBe(false);
    expect(isSidebarItemActive(worksets, "/tasks/new")).toBe(false);
  });

  it("lights 任務與來源 on tasks, editors, and sources", () => {
    expect(isSidebarItemActive(tasks, "/tasks")).toBe(true);
    expect(isSidebarItemActive(tasks, "/tasks/new")).toBe(true);
    expect(isSidebarItemActive(tasks, "/tasks/abc/edit")).toBe(true);
    expect(isSidebarItemActive(tasks, "/sources")).toBe(true);
    expect(isSidebarItemActive(tasks, "/sources/tg-1")).toBe(true);
    expect(isSidebarItemActive(tasks, "/worksets")).toBe(false);
  });

  it("does not light 系統設定 on /settings/ai", () => {
    expect(isSidebarItemActive(settings, "/settings/theme")).toBe(true);
    expect(isSidebarItemActive(settings, "/settings/ai/provider")).toBe(false);
    expect(isSidebarItemActive(ai, "/settings/ai/provider")).toBe(true);
    expect(isSidebarItemActive(ai, "/settings/ai/voice")).toBe(true);
    expect(isSidebarItemActive(ai, "/settings/general")).toBe(false);
  });

  it("lights items and account on nested routes", () => {
    expect(isSidebarItemActive(items, "/items")).toBe(true);
    expect(isSidebarItemActive(items, "/items/finance")).toBe(true);
    expect(isSidebarItemActive(items, "/items/new")).toBe(true);
    expect(isSidebarItemActive(account, "/account/identity")).toBe(true);
    expect(isSidebarItemActive(account, "/account/devices")).toBe(true);
    expect(isSidebarItemActive(account, "/settings")).toBe(false);
  });
});
