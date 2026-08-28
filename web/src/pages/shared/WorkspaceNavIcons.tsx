import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Code2,
  Database,
  MessageSquare,
  Mic,
  Palette,
  ScrollText,
  Users,
} from "lucide-react";

export const workspaceTabIcons: Record<string, LucideIcon> = {
  "/settings/theme": Palette,
  "/settings/data": Database,
  "/settings/integrations": Code2,
  "/settings/logs": ScrollText,
  "/assistant": MessageSquare,
  "/ai/provider": Bot,
  "/ai/voice": Mic,
  "/ai/staff": Users,
};
