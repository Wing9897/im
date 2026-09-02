import { Layers, ListChecks } from "lucide-react";
import i18n from "../../i18n";
import type { AnalysisTask } from "../../types";
import type { Workset } from "../../types/worksets";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { worksetDetailPath } from "../worksets/worksetRoutes";
import { openViewerWindow } from "../../utils/openViewerWindow";
import {
  isSimpleModeHiddenAiTab,
  isSimpleModeHiddenPath,
  isSimpleModeHiddenWorksetTasksTab,
} from "../ui/simpleMode";
import { COMMAND_PALETTE_ACTIONS_DEFS } from "./commandPaletteActionsCommands";
import { COMMAND_PALETTE_NAVIGATION_DEFS } from "./commandPaletteNavigationCommands";
import { COMMAND_PALETTE_SETTINGS_DEFS } from "./commandPaletteSettingsCommands";
import type {
  CommandPaletteActionId,
  CommandPaletteItem,
  CommandPaletteItemDef,
  CommandPaletteTranslate,
} from "./commandPaletteTypes";

export type { CommandPaletteItem } from "./commandPaletteTypes";

const COMMAND_PALETTE_DEFS: readonly CommandPaletteItemDef[] = [
  ...COMMAND_PALETTE_NAVIGATION_DEFS,
  ...COMMAND_PALETTE_SETTINGS_DEFS,
  ...COMMAND_PALETTE_ACTIONS_DEFS,
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

function resolveLabel(def: CommandPaletteItemDef, t: CommandPaletteTranslate): string {
  if (def.labelNs === "nav") {
    return String(t(`nav:${def.labelKey}`));
  }
  return String(t(def.labelKey));
}

/** Build localized static command palette rows. */
function buildCommandPaletteItems(
  t: CommandPaletteTranslate = i18n.t.bind(i18n),
): CommandPaletteItem[] {
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
  t: CommandPaletteTranslate = i18n.t.bind(i18n),
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

/** Build searchable workset rows (opens the contents page). */
export function buildWorksetCommandPaletteItems(
  worksets: readonly Workset[],
  t: CommandPaletteTranslate = i18n.t.bind(i18n),
): CommandPaletteItem[] {
  const group = String(t("commandPalette.groups.worksets"));
  return (worksets ?? []).map((ws) => ({
    id: `workset-${ws.id}`,
    label: ws.id === SYSTEM_WORKSET_ID ? String(t("workset:generalName")) : ws.name,
    to: worksetDetailPath(ws.id),
    icon: Layers,
    group,
    keywords: [ws.id, ws.name, "workset", "工作集"],
  }));
}

function isSimpleModeHiddenCommandTo(to: string | undefined): boolean {
  if (!to) return false;
  const url = new URL(to, "http://im.local");
  return (
    isSimpleModeHiddenPath(url.pathname) ||
    isSimpleModeHiddenWorksetTasksTab(url.pathname, url.search) ||
    isSimpleModeHiddenAiTab(url.pathname)
  );
}

export function filterCommandPaletteItems(
  query: string,
  extraItems: readonly CommandPaletteItem[] = [],
  t: CommandPaletteTranslate = i18n.t.bind(i18n),
  simpleMode = false,
): CommandPaletteItem[] {
  const q = normalize(query);
  const pool = [...buildCommandPaletteItems(t), ...extraItems].filter(
    (item) => !simpleMode || !isSimpleModeHiddenCommandTo(item.to),
  );
  if (!q) return pool;
  return pool.filter((item) => itemMatches(item, q));
}

export function runCommandPaletteAction(action: CommandPaletteActionId): void {
  switch (action) {
    case "open-viewer":
      openViewerWindow();
      break;
    case "open-board":
    case "new-task":
    case "show-shortcuts":
    case "open-assistant-quick":
      break;
    default:
      break;
  }
}
