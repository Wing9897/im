import { useCallback, useState } from "react";

/** Visit-scoped month-grid date reveal: hover previews; 篩選 checkbox persists. */
export function useMonthDateReveal() {
  const [persisted, setPersisted] = useState(false);
  const [preview, setPreview] = useState(false);

  const revealed = persisted || preview;

  const onPersistedChange = useCallback((value: boolean) => {
    setPersisted(value);
  }, []);

  const onPointerEnter = useCallback(() => {
    setPreview(true);
  }, []);

  const onPointerLeave = useCallback(() => {
    setPreview(false);
  }, []);

  return { persisted, revealed, onPersistedChange, onPointerEnter, onPointerLeave };
}

export type MonthDateRevealChrome = {
  persisted: boolean;
  onPersistedChange: (value: boolean) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
};
