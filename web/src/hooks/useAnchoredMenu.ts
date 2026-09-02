import {
  type CSSProperties,
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
   * - `auto`: open rightward in the left half of the viewport, else leftward
   *   (TimelineShowOptions checklist)
   */
  align?: "start" | "end" | "auto";
  /** Gap between anchor bottom and menu top (px). */
  gap?: number;
  /** Viewport edge padding (px). */
  edge?: number;
  /** Fallback menu width before the menu node is measured. */
  fallbackMenuWidth?: number;
  /**
   * When true, prefer opening above the anchor if the measured menu does not
   * fit below and there is more space above.
   */
  flip?: boolean;
  /**
   * Extra deps that should re-run placement (e.g. options.length).
   * Compared by identity each render — pass a stable number/string when possible.
   */
  contentKey?: unknown;
  /** Pointer event type for outside dismiss (MenuSelect uses mousedown). */
  dismissPointerEvent?: "mousedown" | "pointerdown";
  /** Focus the anchor (or root) when dismissing via Escape. */
  restoreFocusOnEscape?: boolean;
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

function resolveMenuLeft({
  align,
  edge,
  menuWidth,
  rect,
}: {
  align: "start" | "end" | "auto";
  edge: number;
  menuWidth: number;
  rect: DOMRect;
}): number {
  const maxLeft = window.innerWidth - menuWidth - edge;
  if (align === "auto") {
    const openRightward = rect.left < window.innerWidth / 2;
    const raw = openRightward ? rect.left : rect.right - menuWidth;
    return Math.max(edge, Math.min(raw, maxLeft));
  }
  if (align === "end") {
    return Math.min(Math.max(edge, rect.right - menuWidth), maxLeft);
  }
  return Math.min(Math.max(edge, rect.left), maxLeft);
}

/** Fixed portal placement shared by MenuSelect and GeminiBaseUrlField. */
export function anchoredMenuPortalStyle(
  menuPos: AnchoredMenuPosition | null,
): CSSProperties {
  return {
    position: "fixed",
    top: menuPos?.top ?? -9999,
    left: menuPos?.left ?? -9999,
    width: menuPos?.width ?? undefined,
    minWidth: menuPos?.width ?? undefined,
    zIndex: 3000,
    visibility: menuPos ? "visible" : "hidden",
  };
}

/**
 * Shared open-state + viewport-anchored placement + outside/Escape dismiss
 * for portaled menus (MenuSelect, AnalysisStatusControl, TimelineShowOptions).
 *
 * Consumers still own portal rendering and menu markup.
 */
export function useAnchoredMenu({
  enabled = true,
  align = "start",
  gap = 4,
  edge = 8,
  fallbackMenuWidth = 140,
  flip = false,
  contentKey,
  dismissPointerEvent = "mousedown",
  restoreFocusOnEscape = false,
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
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      let top = rect.bottom + gap;
      if (flip && menuHeight > 0) {
        const spaceBelow = window.innerHeight - rect.bottom - edge;
        const spaceAbove = rect.top - edge;
        if (menuHeight > spaceBelow && spaceAbove > spaceBelow) {
          top = rect.top - menuHeight - gap;
        }
      }
      setMenuPos({
        top: Math.max(edge, top),
        left: resolveMenuLeft({ align, edge, menuWidth, rect }),
        width: rect.width,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, enabled, align, gap, edge, fallbackMenuWidth, flip, contentKey]);

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
      if (event.key !== "Escape") return;
      setOpenState(false);
      if (restoreFocusOnEscape) {
        (anchorRef.current ?? rootRef.current)?.focus();
      }
    };
    document.addEventListener(dismissPointerEvent, onPointer);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener(dismissPointerEvent, onPointer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, dismissPointerEvent, restoreFocusOnEscape]);

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
