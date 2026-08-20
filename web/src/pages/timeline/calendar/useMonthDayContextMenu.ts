import { useEffect, useRef, useState } from "react";

export type DayContextMenuState = {
  day: Date;
  x: number;
  y: number;
};

/** Keyboard (Escape), pointer-outside, and scroll dismiss for the day-cell context menu. */
export function useMonthDayContextMenu() {
  const [contextMenu, setContextMenu] = useState<DayContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const openDayContextMenu = (day: Date, clientX: number, clientY: number) => {
    const pad = 8;
    const menuWidth = 180;
    const menuHeight = 44;
    const x = Math.min(clientX, window.innerWidth - menuWidth - pad);
    const y = Math.min(clientY, window.innerHeight - menuHeight - pad);
    setContextMenu({ day, x: Math.max(pad, x), y: Math.max(pad, y) });
  };

  return { contextMenu, setContextMenu, menuRef, openDayContextMenu };
}
