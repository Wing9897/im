import { useEffect, type RefObject } from "react";

const SCROLLBAR_REVEAL_MS = 900;

/** Briefly reveal auto-hide scrollbars while the user is actively scrolling. */
export function useRevealScrollbarOnScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const reveal = () => {
      element.classList.add("is-scrolling");
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
      hideTimer = setTimeout(() => {
        element.classList.remove("is-scrolling");
      }, SCROLLBAR_REVEAL_MS);
    };

    element.addEventListener("scroll", reveal, { passive: true });
    return () => {
      element.removeEventListener("scroll", reveal);
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
      element.classList.remove("is-scrolling");
    };
  }, [ref]);
}
