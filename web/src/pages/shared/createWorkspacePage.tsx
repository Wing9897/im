import { useTranslation } from "react-i18next";
import type { WorkspaceNavItem } from "../../types";
import { useSystemSettingsContext } from "../../context/SystemSettingsContext";
import { SettingsWorkspaceShell } from "./WorkspaceShell";

type WorkspaceTabItem = Pick<WorkspaceNavItem, "to" | "labelKey">;

/** `sectionNameKey` is a `settings:` namespace key, resolved at render time. */
export function createWorkspacePage(
  tabItems: readonly WorkspaceTabItem[],
  sectionNameKey: string,
) {
  return function WorkspacePage() {
    const { t } = useTranslation("settings");
    const pageState = useSystemSettingsContext();
    return (
      <SettingsWorkspaceShell
        tabItems={tabItems}
        pageState={pageState}
        sectionName={t(sectionNameKey)}
      />
    );
  };
}
