import { useTranslation } from "react-i18next";

import { getUserEventsFilterLabel } from "./userEvents";

/**
 * Locale-reactive form of `getUserEventsFilterLabel()`.
 *
 * The plain getter reads `i18n.t` imperatively, so a `useMemo` that only closes
 * over it keeps the label from the language that was active when the memo last
 * ran. Depend on this hook's return value instead: `useTranslation` re-renders
 * on `languageChanged`, so the string itself becomes the invalidating dep.
 */
export function useUserEventsFilterLabel(): string {
  useTranslation("timeline");
  return getUserEventsFilterLabel();
}
