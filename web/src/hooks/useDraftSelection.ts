import { useCallback, useEffect, useState } from "react";

/**
 * Keeps a draft copy of a committed value while a modal/picker is open.
 * Resets the draft from `committed` whenever `syncDraft` becomes true (e.g. on open).
 */
export function useDraftSelection<T>(committed: T, syncDraft: boolean) {
  const [draft, setDraft] = useState(committed);

  useEffect(() => {
    if (syncDraft) setDraft(committed);
  }, [syncDraft, committed]);

  const resetDraft = useCallback(() => {
    setDraft(committed);
  }, [committed]);

  return [draft, setDraft, resetDraft] as const;
}
