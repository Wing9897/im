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

export const subscriptionsWorkspaceNavItems = [
  { to: "/subscriptions/mine", labelKey: "tabs.mine" },
  { to: "/subscriptions/published", labelKey: "tabs.published" },
  { to: "/subscriptions/account", labelKey: "tabs.account" },
  { to: "/subscriptions/search", labelKey: "tabs.search" },
] as const satisfies readonly WorkspaceNavItem[];
