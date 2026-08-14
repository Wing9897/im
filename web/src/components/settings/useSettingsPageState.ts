import { useOutletContext } from "react-router-dom";
import type { SystemSettingsPageState } from "../../hooks/useSystemSettingsPage";

/**
 * Settings outlet context accessor.
 *
 * Lives here (not under ``pages/settings``) because AI / account / logs pages
 * also render inside the settings outlet and must not import across features.
 */
export function useSettingsPageState() {
  return useOutletContext<SystemSettingsPageState>();
}
