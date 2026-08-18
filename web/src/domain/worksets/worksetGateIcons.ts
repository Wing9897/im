import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Database,
  Layers,
  ListChecks,
  MessageSquare,
  Newspaper,
  Package,
  Plug,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { PipelineBlockKind, PipelineGateKind } from "./worksetPipelineGraph";

/** Same Lucide marks as flowchart point gates (`WorksetGraphNode`). */
export const WORKSET_GATE_ICONS: Record<PipelineGateKind, LucideIcon> = {
  calendar: CalendarDays,
  calendarWrite: CalendarPlus,
  notify: Bell,
  intel: Sparkles,
  external: Plug,
};

/** Block headers on the household pipeline graph (sidebar language). */
export const WORKSET_BLOCK_ICONS: Record<PipelineBlockKind, LucideIcon> = {
  sources: Database,
  items: Package,
  tasks: ListChecks,
  worksets: Layers,
  assistant: MessageSquare,
  timeline: CalendarDays,
  intel: Newspaper,
  notify: Bell,
  external: Plug,
};

export const WORKSET_GATE_ICON_PROPS = {
  size: 12,
  strokeWidth: 2.25,
} as const;
