import type { WorkspaceNavItem } from "../../types";

export const settingsWorkspaceNavItems = [
  { to: "/settings/general", labelKey: "tabs.general" },
  { to: "/settings/theme", labelKey: "tabs.theme" },
  { to: "/settings/data", labelKey: "tabs.data" },
  { to: "/settings/integrations", labelKey: "tabs.integrations" },
  { to: "/settings/logs", labelKey: "tabs.logs" },
] as const satisfies readonly WorkspaceNavItem[];

export const SETTINGS_AI_BASE = "/settings/ai";

export const aiWorkspaceNavItems = [
  { to: "/settings/ai/provider", labelKey: "tabs.aiProvider" },
  { to: "/settings/ai/voice", labelKey: "tabs.voice" },
  { to: "/settings/ai/staff", labelKey: "tabs.aiStaff" },
] as const satisfies readonly WorkspaceNavItem[];

/** Tab ids for the subscriptions sheet. Paths stay in `legacyPaths.ts`. */
export const subscriptionsWorkspaceNavItems = [
  { id: "mine", labelKey: "tabs.mine" },
  { id: "published", labelKey: "tabs.published" },
  { id: "account", labelKey: "tabs.account" },
  { id: "search", labelKey: "tabs.search" },
] as const;

export type SubscriptionsWorkspaceTabId = (typeof subscriptionsWorkspaceNavItems)[number]["id"];
