import { useOutletContext } from "react-router-dom";
import type { SystemSettingsPageState } from "../../hooks/useSystemSettingsPage";
import { settingsTabItems } from "../shared/WorkspaceShell";
import { createWorkspacePage } from "../shared/createWorkspacePage";

export {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../components/settings/SettingsFormLayout";

type SettingsPageState = SystemSettingsPageState;

export function useSettingsPageState() {
  return useOutletContext<SettingsPageState>();
}

export const SettingsShellPage = createWorkspacePage(
  settingsTabItems,
  "shell.systemSettingsSection",
);
