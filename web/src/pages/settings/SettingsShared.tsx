import { useOutletContext } from "react-router-dom";
import type { SystemSettingsPageState } from "../../hooks/useSystemSettingsPage";
import { settingsTabItems } from "../shared/WorkspaceShell";
import { createWorkspacePage } from "../shared/createWorkspacePage";

/**
 * Settings shell + outlet hook. Shared form surfaces live in
 * ``components/settings/SettingsFormLayout`` — prefer importing those
 * directly from account / logs / ai (and any non-settings feature).
 */
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
