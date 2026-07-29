import type { WorkspaceNavItem } from "../../types";

export const settingsWorkspaceNavItems = [
  { to: "/settings/general", labelKey: "tabs.general" },
  { to: "/settings/theme", labelKey: "tabs.theme" },
  { to: "/settings/data", labelKey: "tabs.data" },
  { to: "/settings/api", labelKey: "tabs.api" },
  { to: "/settings/logs", labelKey: "tabs.logs" },
] as const satisfies readonly WorkspaceNavItem[];

export const aiWorkspaceNavItems = [
  { to: "/ai/provider", labelKey: "tabs.aiProvider" },
  { to: "/ai/voice", labelKey: "tabs.voice" },
  { to: "/ai/analysis-strategy", labelKey: "tabs.analysisStrategy" },
  { to: "/ai/staff", labelKey: "tabs.aiStaff" },
] as const satisfies readonly WorkspaceNavItem[];
