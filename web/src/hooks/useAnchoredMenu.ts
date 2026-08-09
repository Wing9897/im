import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type AnchoredMenuPosition = {
  top: number;
  left: number;
  width: number;
};

export type UseAnchoredMenuOptions = {
  /** When false, positioning/outside-close effects are idle (menu stays closed). */
  enabled?: boolean;
  /**
   * Horizontal alignment of the menu relative to the anchor.
   * - `start`: clamp menu left near anchor.left (MenuSelect)
   * - `end`: prefer anchor.right - menuWidth (AnalysisStatusControl)
   */
  align?: "start" | "end";
  /** Gap between anchor bottom and menu top (px). */
  gap?: number;
  /** Viewport edge padding (px). */
  edge?: number;
  /** Fallback menu width before the menu node is measured. */
  fallbackMenuWidth?: number;
  /**
   * Extra deps that should re-run placement (e.g. options.length).
   * Compared by identity each render — pass a stable number/string when possible.
   */
  contentKey?: unknown;
  /** Pointer event type for outside dismiss (MenuSelect uses mousedown). */
  dismissPointerEvent?: "mousedown" | "pointerdown";
};

export type UseAnchoredMenuResult = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
  menuPos: AnchoredMenuPosition | null;
  /** Anchor element (trigger or root). */
  anchorRef: RefObject<HTMLElement | null>;
  /** Portaled / floating menu element. */
  menuRef: RefObject<HTMLElement | null>;
  /** Optional root that also counts as "inside" for outside-click (e.g. trigger shell). */
  rootRef: RefObject<HTMLElement | null>;
};

/**
 * Shared open-state + viewport-anchored placement + outside/Escape dismiss
 * for portaled menus (MenuSelect, AnalysisStatusControl).
 *
 * Consumers still own portal rendering and menu markup.
 */
export function useAnchoredMenu({
  enabled = true,
  align = "start",
  gap = 4,
  edge = 8,
  fallbackMenuWidth = 140,
  contentKey,
  dismissPointerEvent = "mousedown",
}: UseAnchoredMenuOptions = {}): UseAnchoredMenuResult {
  const [open, setOpenState] = useState(false);
  const [menuPos, setMenuPos] = useState<AnchoredMenuPosition | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!enabled && next) return;
      setOpenState(next);
    },
    [enabled],
  );

  const close = useCallback(() => setOpenState(false), []);
  const toggle = useCallback(() => {
    if (!enabled) return;
    setOpenState((current) => !current);
  }, [enabled]);

  useLayoutEffect(() => {
    const resolveAnchor = () => anchorRef.current ?? rootRef.current;
    if (!open || !enabled || !resolveAnchor()) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const anchor = resolveAnchor();
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth ?? Math.max(rect.width, fallbackMenuWidth);
      const left =
        align === "end"
          ? Math.min(
              Math.max(edge, rect.right - menuWidth),
              window.innerWidth - menuWidth - edge,
            )
          : Math.min(
              Math.max(edge, rect.left),
              window.innerWidth - menuWidth - edge,
            );
      setMenuPos({ top: rect.bottom + gap, left, width: rect.width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, enabled, align, gap, edge, fallbackMenuWidth, contentKey]);

  useEffect(() => {
    // Dismiss while open even if `enabled` flipped false mid-flight.
    if (!open) return;
    const onPointer = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        anchorRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpenState(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenState(false);
    };
    document.addEventListener(dismissPointerEvent, onPointer);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener(dismissPointerEvent, onPointer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, dismissPointerEvent]);

  return {
    open,
    setOpen,
    toggle,
    close,
    menuPos,
    anchorRef,
    menuRef,
    rootRef,
  };
}
