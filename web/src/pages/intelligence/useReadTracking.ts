import { useIdReadTracking } from "../../hooks/useIdReadTracking";
import { INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY } from "../../domain/intelligence/intelligencePersistedKeys";

const READ_INTELLIGENCE_IDS_STORAGE_KEY = INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY;

interface ReadTracking {
  /** Persisted read ids — controls dimming / unread chrome only. */
  readIntelligenceIdSet: Set<string>;
  /** Includes persisted + session auto-read — stops duplicate auto-read timers. */
  isConsumed: (itemId: string) => boolean;
  handleAutoRead: (itemId: string) => void;
}

/**
 * Tracks which intelligence item ids the user has read.
 *
 * Session auto-read updates an in-memory pending list only; cards stay visually
 * unread until the user leaves the page. Pending ids flush to localStorage on
 * unmount (single write path for `READ_INTELLIGENCE_IDS_STORAGE_KEY`).
 */
export function useReadTracking(): ReadTracking {
  const { readIdSet, isConsumed, markRead } = useIdReadTracking(
    READ_INTELLIGENCE_IDS_STORAGE_KEY,
  );
  return {
    readIntelligenceIdSet: readIdSet,
    isConsumed,
    handleAutoRead: markRead,
  };
}
