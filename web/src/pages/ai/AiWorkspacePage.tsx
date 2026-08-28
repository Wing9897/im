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
