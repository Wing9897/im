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
  "/settings/ai/provider": Bot,
  "/settings/ai/voice": Mic,
  "/settings/ai/staff": Users,
};
