/**
 * `/ai/*` workspace chrome (provider / voice / staff tabs).
 * Settings page modules live in `pages/settings/ai/`.
 * Conversational assistant lives in `pages/ai/assistant/` (`/assistant`).
 */
import { useMemo } from "react";
import { aiWorkspaceNavItems } from "../../domain/navigation/workspaceNav";
import { createWorkspacePage } from "../shared/createWorkspacePage";

export function AiWorkspacePage() {
  const Page = useMemo(
    () => createWorkspacePage(aiWorkspaceNavItems, "shell.aiSettingsSection"),
    [],
  );
  return <Page />;
}
