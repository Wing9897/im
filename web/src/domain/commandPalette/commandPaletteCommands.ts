import {
  BellRing,
  Bot,
  CalendarDays,
  Database,
  ExternalLink,
  Gauge,
  History,
  Keyboard,
  ListChecks,
  Map,
  MapPin,
  Code2,
  Palette,
  Plus,
  Radio,
  Rss,
  ScrollText,
  Settings,
  Trophy,
  MessageSquare,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TFunction } from "i18next";
import i18n from "../../i18n";
import type { AnalysisTask } from "../../types";
import { openViewerWindow } from "../../utils/openViewerWindow";

type CommandPaletteActionId =
  | "open-viewer"
  | "new-task"
  | "show-shortcuts"
  | "open-assistant-quick";

type CommandPaletteGroupId = "navigation" | "settings" | "actions" | "tasks";

export interface CommandPaletteItem {
  id: string;
  label: string;
  hint?: string;
  to?: string;
  action?: CommandPaletteActionId;
  keywords?: string[];
  icon: LucideIcon;
  group: string;
}

type Translate = TFunction | typeof i18n.t;

interface CommandPaletteItemDef {
  id: string;
  labelKey: string;
  labelNs?: "nav" | "common";
  hintKey?: string;
  to?: string;
  action?: CommandPaletteActionId;
  keywords?: string[];
  icon: LucideIcon;
  groupId: CommandPaletteGroupId;
}

const COMMAND_PALETTE_DEFS: readonly CommandPaletteItemDef[] = [
  { id: "monitor", labelKey: "monitor", labelNs: "nav", to: "/monitor", icon: Radio, groupId: "navigation", keywords: ["monitor", "stream"] },
  { id: "monitor-wall", labelKey: "commandPalette.monitorWall", to: "/monitor?view=wall", icon: Radio, groupId: "navigation", keywords: ["wall", "看板"] },
  { id: "tasks", labelKey: "tasks", labelNs: "nav", to: "/tasks", icon: ListChecks, groupId: "navigation", keywords: ["task"] },
  { id: "leaderboard", labelKey: "leaderboard", labelNs: "nav", to: "/leaderboard", icon: Trophy, groupId: "navigation" },
  { id: "intelligence", labelKey: "keyEvents", labelNs: "nav", to: "/intelligence", icon: MapPin, groupId: "navigation", keywords: ["intel"] },
  {
    id: "intelligence-map",
    labelKey: "commandPalette.keyEventsMap",
    to: "/intelligence?view=map",
    icon: Map,
    groupId: "navigation",
    keywords: ["map", "地圖"],
  },
  {
    id: "intelligence-list",
    labelKey: "commandPalette.keyEventsList",
    to: "/intelligence?view=list",
    icon: MapPin,
    groupId: "navigation",
    keywords: ["list"],
  },
  {
    id: "intelligence-card",
    labelKey: "commandPalette.keyEventsCard",
    to: "/intelligence?view=card",
    icon: MapPin,
    groupId: "navigation",
    keywords: ["card"],
  },
  { id: "timeline", labelKey: "timeline", labelNs: "nav", to: "/timeline", icon: CalendarDays, groupId: "navigation" },
  { id: "actions", labelKey: "actions", labelNs: "nav", to: "/actions", icon: BellRing, groupId: "navigation" },
  {
    id: "actions-voice",
    labelKey: "commandPalette.actionsVoice",
    to: "/actions?tab=voice",
    icon: BellRing,
    groupId: "navigation",
    keywords: ["voice", "語音", "提醒"],
  },
  {
    id: "actions-history",
    labelKey: "commandPalette.actionsHistory",
    to: "/actions?tab=history",
    icon: History,
    groupId: "navigation",
    keywords: ["history", "紀錄", "觸發"],
  },
  { id: "accounts", labelKey: "sources", labelNs: "nav", to: "/accounts", icon: Database, groupId: "navigation", keywords: ["source"] },
  {
    id: "assistant",
    labelKey: "assistant",
    labelNs: "nav",
    to: "/assistant",
    icon: MessageSquare,
    groupId: "navigation",
    keywords: ["assistant", "語音", "chat", "日程", "AI 助手"],
  },
  {
    id: "accounts-rss",
    labelKey: "commandPalette.sourcesRss",
    to: "/accounts?tab=rss",
    icon: Rss,
    groupId: "navigation",
    keywords: ["rss", "folo"],
  },
  {
    id: "accounts-telegram",
    labelKey: "commandPalette.sourcesTelegram",
    to: "/accounts?tab=telegram",
    icon: Database,
    groupId: "navigation",
    keywords: ["telegram"],
  },
  {
    id: "accounts-discord",
    labelKey: "commandPalette.sourcesDiscord",
    to: "/accounts?tab=discord",
    icon: Database,
    groupId: "navigation",
    keywords: ["discord"],
  },
  {
    id: "accounts-http",
    labelKey: "commandPalette.sourcesHttp",
    to: "/accounts?tab=http",
    icon: Database,
    groupId: "navigation",
    keywords: ["http", "抓取", "poll"],
  },
  {
    id: "accounts-http-webhook",
    labelKey: "commandPalette.sourcesHttpWebhook",
    to: "/accounts?tab=http&mode=webhook",
    icon: Database,
    groupId: "navigation",
    keywords: ["webhook", "api key", "ingestion"],
  },
  {
    id: "accounts-mqtt",
    labelKey: "commandPalette.sourcesMqtt",
    to: "/accounts?tab=mqtt",
    icon: Database,
    groupId: "navigation",
    keywords: ["mqtt", "broker"],
  },
  {
    id: "accounts-email",
    labelKey: "commandPalette.sourcesEmail",
    to: "/accounts?tab=email",
    icon: Database,
    groupId: "navigation",
    keywords: ["email", "imap", "郵件"],
  },
  { id: "ai", labelKey: "aiSettings", labelNs: "nav", to: "/ai/provider", icon: Bot, groupId: "settings" },
  {
    id: "ai-voice",
    labelKey: "commandPalette.aiVoice",
    to: "/ai/voice",
    icon: Bot,
    groupId: "settings",
    keywords: ["stt", "tts", "麥克風", "朗讀"],
  },
  {
    id: "ai-strategy",
    labelKey: "commandPalette.aiStrategy",
    to: "/ai/analysis-strategy",
    icon: Gauge,
    groupId: "settings",
    keywords: ["batch", "concurrent", "調度"],
  },
  {
    id: "ai-staff",
    labelKey: "commandPalette.aiStaff",
    to: "/ai/staff",
    icon: Users,
    groupId: "settings",
    keywords: ["員工", "介紹", "assistant", "agent", "staff"],
  },
  { id: "settings", labelKey: "systemSettings", labelNs: "nav", to: "/settings", icon: Settings, groupId: "settings" },
  { id: "theme", labelKey: "commandPalette.theme", to: "/settings/theme", icon: Palette, groupId: "settings", keywords: ["theme", "color"] },
  {
    id: "settings-data",
    labelKey: "commandPalette.settingsData",
    to: "/settings/data",
    icon: Wrench,
    groupId: "settings",
    keywords: ["reset", "database", "資料"],
  },
  {
    id: "settings-api",
    labelKey: "commandPalette.settingsApi",
    to: "/settings/api",
    icon: Code2,
    groupId: "settings",
    keywords: [
      "api",
      "webhook",
      "a2a",
      "客户经理",
      "客戶經理",
      "account manager",
      "liaison",
      "keys",
    ],
  },
  { id: "logs", labelKey: "logs", labelNs: "nav", to: "/settings/logs", icon: ScrollText, groupId: "settings" },
  {
    id: "new-task",
    labelKey: "commandPalette.newTask",
    action: "new-task",
    to: "/tasks/new",
    icon: Plus,
    groupId: "actions",
    keywords: ["create"],
  },
  {
    id: "new-action",
    labelKey: "commandPalette.newAction",
    to: "/actions",
    icon: BellRing,
    groupId: "actions",
    keywords: ["notify", "webhook"],
    hintKey: "commandPalette.newActionHint",
  },
  {
    id: "open-viewer",
    labelKey: "commandPalette.openViewer",
    action: "open-viewer",
    icon: ExternalLink,
    groupId: "actions",
    hintKey: "commandPalette.openViewerHint",
  },
  {
    id: "shortcut-help",
    labelKey: "commandPalette.shortcutHelp",
    action: "show-shortcuts",
    icon: Keyboard,
    groupId: "actions",
    keywords: ["keyboard", "shortcuts", "hotkeys", "快捷鍵"],
  },
  {
    id: "open-assistant-quick",
    labelKey: "commandPalette.quickAssistant",
    action: "open-assistant-quick",
    icon: MessageSquare,
    groupId: "actions",
    hintKey: "commandPalette.quickAssistantHint",
    // 「快捷助手」 is a search alias only; visible label comes from i18n「助手」.
    keywords: ["助手", "快捷助手", "quick", "popup", "J", "assistant"],
  },
];

const MAX_TASK_ITEMS = 24;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function itemMatches(item: CommandPaletteItem, q: string): boolean {
  const haystack = [item.label, item.hint ?? "", ...(item.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q) || item.label.toLowerCase().includes(q);
}

function resolveLabel(def: CommandPaletteItemDef, t: Translate): string {
  if (def.labelNs === "nav") {
    return String(t(`nav:${def.labelKey}`));
  }
  return String(t(def.labelKey));
}

/** Build localized static command palette rows. */
function buildCommandPaletteItems(t: Translate = i18n.t.bind(i18n)): CommandPaletteItem[] {
  return COMMAND_PALETTE_DEFS.map((def) => ({
    id: def.id,
    label: resolveLabel(def, t),
    hint: def.hintKey ? String(t(def.hintKey)) : undefined,
    to: def.to,
    action: def.action,
    keywords: def.keywords,
    icon: def.icon,
    group: String(t(`commandPalette.groups.${def.groupId}`)),
  }));
}

/** Build searchable task rows for the command palette (edit deep-link). */
export function buildTaskCommandPaletteItems(
  tasks: readonly AnalysisTask[],
  t: Translate = i18n.t.bind(i18n),
): CommandPaletteItem[] {
  const group = String(t("commandPalette.groups.tasks"));
  const unnamed = String(t("commandPalette.unnamedTask"));
  return tasks.slice(0, MAX_TASK_ITEMS).map((task) => ({
    id: `task-${task.id}`,
    label: task.name || unnamed,
    hint: task.analysisMode,
    to: `/tasks/${task.id}/edit`,
    icon: ListChecks,
    group,
    keywords: [task.id, task.analysisMode, task.name],
  }));
}

export function filterCommandPaletteItems(
  query: string,
  extraItems: readonly CommandPaletteItem[] = [],
  t: Translate = i18n.t.bind(i18n),
): CommandPaletteItem[] {
  const q = normalize(query);
  const pool = [...buildCommandPaletteItems(t), ...extraItems];
  if (!q) return pool;
  return pool.filter((item) => itemMatches(item, q));
}

export function runCommandPaletteAction(action: CommandPaletteActionId): void {
  switch (action) {
    case "open-viewer":
      openViewerWindow();
      break;
    case "new-task":
    case "show-shortcuts":
    case "open-assistant-quick":
      break;
    default:
      break;
  }
}
