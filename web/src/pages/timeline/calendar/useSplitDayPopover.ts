import { useEffect, useRef, useState } from "react";
import { isSameDay } from "../../../domain/timeline/dateUtils";

export type SplitDayPopoverTarget = {
  cardKey: string;
  day: Date;
};

/** One in-card day popover at a time; Esc and pointer-outside dismiss. */
export function useSplitDayPopover() {
  const [open, setOpen] = useState<SplitDayPopoverTarget | null>(null);
  /** Last day clicked on a specific card; not shared across cards. Survives popover close. */
  const [selected, setSelected] = useState<SplitDayPopoverTarget | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (target.closest('[data-testid="timeline-split-month-day"]')) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  const toggleDay = (cardKey: string, day: Date) => {
    setSelected({ cardKey, day });
    setOpen((prev) => {
      if (prev && prev.cardKey === cardKey && isSameDay(prev.day, day)) return null;
      return { cardKey, day };
    });
  };

  return { open, selected, popoverRef, toggleDay, close: () => setOpen(null) };
}
