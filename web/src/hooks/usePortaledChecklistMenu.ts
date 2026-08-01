import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type UsePortaledChecklistMenuOptions = {
  /** Repositions the menu when its content size may have changed. */
  contentKey?: unknown;
  menuWidth?: number;
};

const FOCUSABLE_SELECTOR = [
  "[data-checklist-initial-focus]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Shared interaction and viewport positioning for checklist dialogs rendered
 * through a portal. Consumers remain responsible for rendering the portal.
 */
export function usePortaledChecklistMenu({
  contentKey,
  menuWidth = 200,
}: UsePortaledChecklistMenuOptions = {}) {
  const reactId = useId();
  const idSuffix = reactId.replace(/:/g, "");
  const triggerId = `portaled-checklist-trigger-${idSuffix}`;
  const menuId = `portaled-checklist-menu-${idSuffix}`;
  const titleId = `portaled-checklist-title-${idSuffix}`;
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusedForCurrentOpen = useRef(false);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuPosition(null);
      return;
    }

    const gap = 4;
    const edge = 8;
    const horizontalLeft = (rect: DOMRect) => {
      const maxLeft = window.innerWidth - menuWidth - edge;
      const openRightward = rect.left < window.innerWidth / 2;
      const raw = openRightward ? rect.left : rect.right - menuWidth;
      return Math.max(edge, Math.min(raw, maxLeft));
    };

    const place = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      const spaceBelow = window.innerHeight - rect.bottom - edge;
      const spaceAbove = rect.top - edge;
      let top = rect.bottom + gap;
      if (menuHeight > 0 && menuHeight > spaceBelow && spaceAbove > spaceBelow) {
        top = rect.top - menuHeight - gap;
      }
      setMenuPosition({
        top: Math.max(edge, top),
        left: horizontalLeft(rect),
      });
    };

    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + gap,
      left: horizontalLeft(rect),
    });
    const raf = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [contentKey, menuWidth, open]);

  useEffect(() => {
    if (
      !open ||
      !menuPosition ||
      !menuRef.current ||
      focusedForCurrentOpen.current
    ) {
      return;
    }
    const initialFocus = menuRef.current.querySelector<HTMLElement>(
      "[data-checklist-initial-focus]",
    );
    (initialFocus ?? menuRef.current).focus();
    focusedForCurrentOpen.current = true;
  }, [menuPosition, open]);

  useEffect(() => {
    if (!open) {
      focusedForCurrentOpen.current = false;
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !menuRef.current) {
      return;
    }
    const focusable = Array.from(
      menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      menuRef.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === menuRef.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return {
    open,
    toggle: () => setOpen((value) => !value),
    triggerRef,
    menuRef,
    menuPosition,
    triggerId,
    menuId,
    titleId,
    onMenuKeyDown,
  };
}
