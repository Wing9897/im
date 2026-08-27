import { isSimpleModeHiddenPath } from "./simpleMode";

export type SidebarIconKey =
  | "monitor"
  | "tasks"
  | "worksets"
  | "schedule"
  | "items"
  | "sources"
  | "leaderboard"
  | "intelligence"
  | "timeline"
  | "subscriptions"
  | "notify"
  | "assistant"
  | "ai"
  | "settings"
  | "account";

export interface SidebarNavItemModel {
  to: string;
  labelKey: string;
  icon: SidebarIconKey;
  activePrefix?: string;
}

export interface SidebarNavGroupModel {
  labelKey: string | null;
  items: readonly SidebarNavItemModel[];
}

export const SIDEBAR_MAIN_GROUPS: readonly SidebarNavGroupModel[] = [
  { labelKey: null, items: [{ to: "/monitor", labelKey: "monitor", icon: "monitor" }] },
  {
    labelKey: "groupManage",
    items: [
      { to: "/worksets", labelKey: "worksets", icon: "worksets", activePrefix: "/worksets" },
      { to: "/tasks", labelKey: "tasks", icon: "tasks", activePrefix: "/tasks" },
      { to: "/schedule", labelKey: "schedule", icon: "schedule", activePrefix: "/schedule" },
      { to: "/items", labelKey: "items", icon: "items" },
      { to: "/sources", labelKey: "sources", icon: "sources", activePrefix: "/sources" },
    ],
  },
  {
    labelKey: "groupIntelligence",
    items: [
      { to: "/leaderboard", labelKey: "leaderboard", icon: "leaderboard" },
      { to: "/intelligence", labelKey: "keyEvents", icon: "intelligence" },
    ],
  },
  {
    labelKey: "groupTime",
    items: [
      { to: "/timeline", labelKey: "timeline", icon: "timeline" },
      {
        to: "/subscriptions",
        labelKey: "subscriptions",
        icon: "subscriptions",
        activePrefix: "/subscriptions",
      },
    ],
  },
  {
    labelKey: "groupInteract",
    items: [
      { to: "/notify", labelKey: "notify", icon: "notify" },
      { to: "/assistant", labelKey: "assistant", icon: "assistant" },
    ],
  },
];

export const SIDEBAR_BOTTOM_ITEMS: readonly SidebarNavItemModel[] = [
  { to: "/ai/provider", labelKey: "aiSettings", icon: "ai", activePrefix: "/ai" },
  {
    to: "/settings",
    labelKey: "systemSettings",
    icon: "settings",
    activePrefix: "/settings",
  },
  { to: "/account/identity", labelKey: "account", icon: "account" },
];

export const MAIN_SIDEBAR_PREFETCH_PATHS: readonly string[] = SIDEBAR_MAIN_GROUPS.flatMap(
  (group) => group.items.map((item) => item.to),
);

export function visibleSidebarGroups(simpleMode: boolean): SidebarNavGroupModel[] {
  return SIDEBAR_MAIN_GROUPS.map((group) => ({
    ...group,
    items: simpleMode
      ? group.items.filter((item) => !isSimpleModeHiddenPath(item.to))
      : group.items,
  })).filter((group) => group.items.length > 0);
}

export function isSidebarItemActive(item: SidebarNavItemModel, pathname: string): boolean {
  if (item.to === "/tasks") {
    return pathname === "/tasks" || pathname.startsWith("/tasks/");
  }
  return item.activePrefix
    ? pathname.startsWith(item.activePrefix)
    : pathname === item.to;
}
