/**
 * Lifecycle latch: while a picker is dismissing, ignore trigger opens.
 * Cleared only from `onExited` (after ModalDialog fully parks/unmounts).
 * Replaces the previous wall-clock suppress window.
 */
export function createEmojiPickerOpenLatch(): {
  blockOpen: () => void;
  clearOpenBlock: () => void;
  isOpenBlocked: () => boolean;
} {
  let blocked = false;
  return {
    blockOpen: () => {
      blocked = true;
    },
    clearOpenBlock: () => {
      blocked = false;
    },
    isOpenBlocked: () => blocked,
  };
}
