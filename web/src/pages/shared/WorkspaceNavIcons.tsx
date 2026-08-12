import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Cable,
  Code2,
  Database,
  MessageSquare,
  Mic,
  Palette,
  ScrollText,
  SlidersHorizontal,
  Users,
} from "lucide-react";

export const workspaceTabIcons: Record<string, LucideIcon> = {
  "/settings/theme": Palette,
  "/settings/data": Database,
  "/settings/api": Code2,
  "/settings/mcp": Cable,
  "/settings/logs": ScrollText,
  "/assistant": MessageSquare,
  "/ai/provider": Bot,
  "/ai/voice": Mic,
  "/ai/analysis-strategy": SlidersHorizontal,
  "/ai/staff": Users,
};
