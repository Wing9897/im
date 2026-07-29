import { useEffect } from "react";
import { isEditableTarget } from "../utils/isEditableTarget";

interface UseListKeyboardNavigationOptions<T> {
  items: readonly T[];
  /** Currently highlighted row (focus cursor). */
  selectedId: string | null;
  getItemId: (item: T) => string;
  /** Called on ArrowUp/Down / j / k — move focus without opening detail. */
  onSelect: (item: T) => void;
  /**
   * Called on Enter — open / activate the focused row.
   * When omitted, Enter also calls `onSelect` (default: Enter selects).
   */
  onActivate?: (item: T) => void;
  /** Called on Escape to close detail without changing the focus cursor. */
  onEscape?: () => void;
  enabled?: boolean;
}

/** ArrowUp/Down + j/k focus; Enter activates (Linear/Cursor-style). */
export function useListKeyboardNavigation<T>({
  items,
  selectedId,
  getItemId,
  onSelect,
  onActivate,
  onEscape,
  enabled = true,
}: UseListKeyboardNavigationOptions<T>) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      if (items.length === 0) return;

      const currentIndex =
        selectedId != null
          ? items.findIndex((item) => getItemId(item) === selectedId)
          : -1;

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        const nextIndex =
          currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1);
        const next = items[nextIndex];
        if (next !== undefined) onSelect(next);
        return;
      }

      if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        const prevIndex =
          currentIndex < 0 ? items.length - 1 : Math.max(currentIndex - 1, 0);
        const prev = items[prevIndex];
        if (prev !== undefined) onSelect(prev);
        return;
      }

      if (event.key === "Enter" && currentIndex >= 0) {
        event.preventDefault();
        const current = items[currentIndex];
        if (current === undefined) return;
        if (onActivate) {
          onActivate(current);
        } else {
          onSelect(current);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, getItemId, items, onActivate, onEscape, onSelect, selectedId]);
}
