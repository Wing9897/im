import {
  BellRing,
  Bookmark,
  CalendarClock,
  CalendarDays,
  Database,
  History,
  LayoutGrid,
  ListChecks,
  Layers,
  Map,
  MapPin,
  Radio,
  Rss,
  Trophy,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  appDestinationsInPaletteOrder,
  resolveAppDestinationHref,
  type AppDestination,
} from "../navigation/appDestinations";
import type { CommandPaletteItemDef } from "./commandPaletteTypes";

const PALETTE_NAV_ICONS: Record<string, LucideIcon> = {
  monitor: Radio,
  "monitor-wall": Radio,
  tasks: ListChecks,
  worksets: Layers,
  schedule: CalendarClock,
  leaderboard: Trophy,
  intelligence: MapPin,
  "intelligence-map": Map,
  "intelligence-list": MapPin,
  "intelligence-card": MapPin,
  timeline: CalendarDays,
  subscriptions: Bookmark,
  "subscriptions-published": Bookmark,
  "subscriptions-search": Bookmark,
  "subscriptions-account": Bookmark,
  notify: BellRing,
  "notify-voice": BellRing,
  "notify-history": History,
  sources: Database,
  assistant: MessageSquare,
  "sources-rss": Rss,
  "sources-telegram": Database,
  "sources-discord": Database,
  "sources-http": Database,
  "sources-http-webhook": Database,
  "sources-mqtt": Database,
  "sources-email": Database,
};

const OPEN_OPS_BOARD: CommandPaletteItemDef = {
  id: "board",
  labelKey: "commandPalette.openOpsBoard",
  action: "open-board",
  icon: LayoutGrid,
  groupId: "navigation",
  hintKey: "commandPalette.openOpsBoardHint",
  keywords: ["ops", "board", "canvas", "畫布", "画布", "ops board"],
};

function paletteIcon(id: string): LucideIcon {
  const icon = PALETTE_NAV_ICONS[id];
  if (!icon) {
    throw new Error(`Missing command palette icon for ${id}`);
  }
  return icon;
}

function toNavigationCommand(dest: AppDestination): CommandPaletteItemDef {
  return {
    id: dest.id,
    labelKey: dest.labelKey,
    ...(dest.labelNs ? { labelNs: dest.labelNs } : {}),
    to: resolveAppDestinationHref(dest.paths[0]),
    icon: paletteIcon(dest.id),
    groupId: "navigation",
    ...(dest.paletteKeywords ? { keywords: [...dest.paletteKeywords] } : {}),
  };
}

export const COMMAND_PALETTE_NAVIGATION_DEFS: readonly CommandPaletteItemDef[] =
  appDestinationsInPaletteOrder().flatMap((dest) => {
    const command = toNavigationCommand(dest);
    return dest.id === "monitor" ? [command, OPEN_OPS_BOARD] : [command];
  });
