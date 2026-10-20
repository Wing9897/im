import {
  appDestinationPrefetchPaths,
  appDestinationsInSidebarOrder,
  resolveAppDestinationHref,
  type SidebarAppDestination,
  type SidebarIconKey,
} from "../navigation/appDestinations";
import { isSimpleModeHiddenPath } from "./simpleMode";

export type { SidebarIconKey };

export interface SidebarNavItemModel {
  to: string;
  labelKey: string;
  icon: SidebarIconKey;
  activePrefix?: string;
  /** When one item covers more than one URL family (tasks and sources). */
  activePrefixes?: readonly string[];
}

export interface SidebarNavGroupModel {
  labelKey: string | null;
  items: readonly SidebarNavItemModel[];
}

function toSidebarItem(dest: SidebarAppDestination): SidebarNavItemModel {
  const { icon, activePrefix, activePrefixes } = dest.sidebar;
  return {
    to: resolveAppDestinationHref(dest.paths[0]),
    labelKey: dest.labelKey,
    icon,
    ...(activePrefix ? { activePrefix } : {}),
    ...(activePrefixes ? { activePrefixes } : {}),
  };
}

function projectMainGroups(): readonly SidebarNavGroupModel[] {
  const groups: SidebarNavGroupModel[] = [];
  for (const dest of appDestinationsInSidebarOrder()) {
    const labelKey = dest.sidebar.groupKey;
    const item = toSidebarItem(dest);
    const current = groups[groups.length - 1];
    if (current && current.labelKey === labelKey) {
      groups[groups.length - 1] = { labelKey, items: [...current.items, item] };
    } else {
      groups.push({ labelKey, items: [item] });
    }
  }
  return groups;
}

export const SIDEBAR_MAIN_GROUPS: readonly SidebarNavGroupModel[] = projectMainGroups();

export const SIDEBAR_BOTTOM_ITEMS: readonly SidebarNavItemModel[] = [
  { to: "/settings/ai/provider", labelKey: "aiSettings", icon: "ai", activePrefix: "/settings/ai" },
  {
    to: "/settings",
    labelKey: "systemSettings",
    icon: "settings",
    activePrefix: "/settings",
  },
  { to: "/account/identity", labelKey: "account", icon: "account", activePrefix: "/account" },
];

export const MAIN_SIDEBAR_PREFETCH_PATHS: readonly string[] = appDestinationPrefetchPaths();

export function visibleSidebarGroups(simpleMode: boolean): SidebarNavGroupModel[] {
  return SIDEBAR_MAIN_GROUPS.map((group) => ({
    ...group,
    items: simpleMode
      ? group.items.filter((item) => !isSimpleModeHiddenPath(item.to))
      : group.items,
  })).filter((group) => group.items.length > 0);
}

export function isSidebarItemActive(item: SidebarNavItemModel, pathname: string): boolean {
  if (item.activePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  if (item.activePrefix === "/settings") {
    return pathname.startsWith("/settings") && !pathname.startsWith("/settings/ai");
  }
  if (item.activePrefix === "/worksets") {
    return pathname === "/worksets" || pathname.startsWith("/worksets/");
  }
  return item.activePrefix
    ? pathname.startsWith(item.activePrefix)
    : pathname === item.to;
}
