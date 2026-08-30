import { useCallback, useMemo } from "react";

import { TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY } from "../../domain/prefs";
import {
  parseBlockCardColorMap,
  type BlockCardColorChoice,
  type BlockCardColorMap,
} from "../../domain/timeline/blockCardColors";
import { usePersistedState } from "../../hooks/usePersistedState";

export function useBlockCardColors() {
  const [raw, setRaw] = usePersistedState<unknown>(
    TIMELINE_BLOCK_CARD_COLORS_STORAGE_KEY,
    {},
  );
  const colors = useMemo(() => parseBlockCardColorMap(raw), [raw]);

  const setCardColor = useCallback(
    (cardKey: string, color: BlockCardColorChoice | null) => {
      setRaw((prev: unknown) => {
        const next: BlockCardColorMap = { ...parseBlockCardColorMap(prev) };
        if (color == null) {
          delete next[cardKey];
        } else {
          next[cardKey] = color;
        }
        return next;
      });
    },
    [setRaw],
  );

  return { colors, setCardColor };
}
