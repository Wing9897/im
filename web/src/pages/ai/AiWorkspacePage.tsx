import { useMemo } from "react";
import { aiWorkspaceNavItems } from "../../domain/navigation/workspaceNav";
import { isSimpleModeHiddenAiTab } from "../../domain/ui/simpleMode";
import { useSimpleMode } from "../../context/SimpleModeContext";
import { createWorkspacePage } from "../shared/createWorkspacePage";

function AiWorkspacePageInner() {
  const { simpleMode } = useSimpleMode();
  const tabItems = useMemo(
    () =>
      simpleMode
        ? aiWorkspaceNavItems.filter((item) => !isSimpleModeHiddenAiTab(item.to))
        : aiWorkspaceNavItems,
    [simpleMode],
  );
  const Page = useMemo(
    () => createWorkspacePage(tabItems, "shell.aiSettingsSection"),
    [tabItems],
  );
  return <Page />;
}

export function AiWorkspacePage() {
  return <AiWorkspacePageInner />;
}
