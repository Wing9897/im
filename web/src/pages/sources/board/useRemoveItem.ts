import { useCallback, useState } from "react";
import { toErrorMessage } from "../../../utils/errors";

interface UseRemoveItemOptions<T> {
  /** Async function that performs the actual removal (e.g. API call). */
  removeFn: (target: T) => Promise<void>;
  /** Called after successful removal to refresh the list. */
  onRemoved: () => Promise<void> | void;
  /** Called when removal fails with an error message. */
  onError: (message: string) => void;
}

interface UseRemoveItemReturn<T> {
  /** The item currently targeted for removal (shown in confirmation dialog). */
  removeTarget: T | null;
  /** Set the item to confirm removal, or null to cancel. */
  setRemoveTarget: (target: T | null) => void;
  /** Whether a removal is currently in progress. */
  removing: boolean;
  /** Execute the removal of the current `removeTarget`. */
  confirmRemove: () => Promise<void>;
}

/**
 * Encapsulates the common "confirm then remove" pattern:
 * 1. User selects an item → `setRemoveTarget(item)`
 * 2. User confirms → `confirmRemove()` calls `removeFn`, clears target, refreshes list
 * 3. On error → `onError` is called with the message
 */
export function useRemoveItem<T>({
  removeFn,
  onRemoved,
  onError,
}: UseRemoveItemOptions<T>): UseRemoveItemReturn<T> {
  const [removeTarget, setRemoveTarget] = useState<T | null>(null);
  const [removing, setRemoving] = useState(false);

  const confirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeFn(removeTarget);
      setRemoveTarget(null);
      await onRemoved();
    } catch (e) {
      onError(toErrorMessage(e));
    } finally {
      setRemoving(false);
    }
  }, [removeTarget, removeFn, onRemoved, onError]);

  return { removeTarget, setRemoveTarget, removing, confirmRemove };
}
