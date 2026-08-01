import { useEffect } from "react";
import { isEditableTarget } from "../utils/isEditableTarget";

/**
 * Cursor-style `/` focuses the page search field marked with `data-im-search`.
 */
export function useSlashFocusSearch(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const input = document.querySelector<HTMLInputElement>(
        "input[data-im-search], textarea[data-im-search]",
      );
      if (!input || input.disabled) return;

      event.preventDefault();
      input.focus();
      input.select?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
