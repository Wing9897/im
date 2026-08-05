import { useCallback, useState } from "react";

/** Shared selection lifecycle for read-only source detail dialogs. */
export function useSourceDetailTarget<T>() {
  const [detailTarget, setDetailTarget] = useState<T | null>(null);
  const closeDetail = useCallback(() => setDetailTarget(null), []);
  return { detailTarget, setDetailTarget, closeDetail };
}
