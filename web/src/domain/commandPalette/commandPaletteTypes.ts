import type { LucideIcon } from "lucide-react";
import type { TFunction } from "i18next";

export type CommandPaletteActionId =
  | "open-viewer"
  | "open-board"
  | "new-task"
  | "show-shortcuts"
  | "open-assistant-quick";

export type CommandPaletteGroupId = "navigation" | "settings" | "actions" | "tasks";

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

export type CommandPaletteTranslate = TFunction;

export interface CommandPaletteItemDef {
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
