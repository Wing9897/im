import { type Dispatch, type SetStateAction, useCallback } from "react";

import { TIMELINE_SUBSCRIBE_FILTER_KEY } from "../prefs";
import { usePersistedState } from "../../hooks/usePersistedState";
import {
  parseSubscribedCalendarSelection,
  type SubscribedCalendarSelection,
} from "./subscribedCalendars";

/**
 * Timeline display filter for subscribed calendars (mine catalog).
 * Device localStorage only — not board ui-prefs and not SourceFilterSelection.
 */
export function usePersistedSubscribeFilter(): readonly [
  SubscribedCalendarSelection,
  Dispatch<SetStateAction<SubscribedCalendarSelection>>,
] {
  const [raw, setRaw] = usePersistedState<unknown>(TIMELINE_SUBSCRIBE_FILTER_KEY, null);
  const value = parseSubscribedCalendarSelection(raw);
  const setValue = useCallback(
    (update: SetStateAction<SubscribedCalendarSelection>) => {
      setRaw((prev) => {
        const current = parseSubscribedCalendarSelection(prev);
        return typeof update === "function" ? update(current) : update;
      });
    },
    [setRaw],
  );
  return [value, setValue] as const;
}
