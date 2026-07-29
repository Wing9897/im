import { useEffect, useRef, type RefObject } from "react";

/**
 * Keep a scrollable messages container pinned to the bottom when deps change
 * (new messages, streaming / tool steps, sending indicator).
 */
export function useStickToBottom(
  deps: readonly unknown[],
  behavior: ScrollBehavior = "smooth",
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof node.scrollTo === "function") {
      node.scrollTo({ top: node.scrollHeight, behavior });
    } else {
      node.scrollTop = node.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns the dependency list
  }, deps);

  return ref;
}
