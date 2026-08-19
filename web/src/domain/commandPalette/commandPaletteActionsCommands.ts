import {
  BellRing,
  ExternalLink,
  Keyboard,
  MessageSquare,
  Plus,
} from "lucide-react";
import type { CommandPaletteItemDef } from "./commandPaletteTypes";

export const COMMAND_PALETTE_ACTIONS_DEFS: readonly CommandPaletteItemDef[] = [
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
    to: "/notify",
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
