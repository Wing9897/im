import { describe, expect, it } from "vitest";
import { SIDEBAR_MAIN_GROUPS, visibleSidebarGroups } from "./sidebarNavigation";

function hrefs(simpleMode: boolean): string[] {
  return visibleSidebarGroups(simpleMode).flatMap((group) => group.items.map((item) => item.to));
}

describe("visibleSidebarGroups", () => {
  it("keeps the full nav including Tasks when simple mode is off", () => {
    const full = hrefs(false);
    expect(full).toEqual(SIDEBAR_MAIN_GROUPS.flatMap((group) => group.items.map((item) => item.to)));
    expect(full).toContain("/tasks");
    expect(full).toContain("/monitor");
  });

  it("hides Tasks and collect/analyze entries in simple mode", () => {
    const simple = hrefs(true);
    expect(simple).toEqual(["/worksets", "/schedule", "/items", "/timeline", "/subscriptions", "/notify", "/assistant"]);
    expect(simple).not.toContain("/tasks");
    expect(simple).not.toContain("/monitor");
    expect(simple).not.toContain("/sources");
    expect(simple).not.toContain("/leaderboard");
    expect(simple).not.toContain("/intelligence");
  });

  it("drops empty intelligence group in simple mode", () => {
    const groups = visibleSidebarGroups(true);
    expect(groups.some((group) => group.labelKey === "groupIntelligence")).toBe(false);
    expect(groups.some((group) => group.labelKey === "groupTime")).toBe(true);
    expect(groups.some((group) => group.labelKey === "groupManage")).toBe(true);
  });
});
