/**
 * Dedicated notify-flash host (full-width top bar). Separate from ToastContext
 * so reminder flashes do not share the operational save/error toast array.
 */

export const NOTIFY_FLASH_CHANGED_EVENT = "im:notify-flash-changed";
/** Timed 闪现 auto-dismiss. Persistent mode ignores this. */
export const NOTIFY_FLASH_DURATION_MS = 10_000;

export type NotifyFlashItem = {
  id: string;
  text: string;
  shownAtMs: number;
  persist: boolean;
};

export type ShowNotifyFlashOpts = {
  /** When true, stays until the user dismisses the bar. Default: timed. */
  persist?: boolean;
};

let seq = 0;
let items: NotifyFlashItem[] = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFY_FLASH_CHANGED_EVENT));
  }
}

function cloneItems(): NotifyFlashItem[] {
  return items.map((row) => ({ ...row }));
}

function clearAll(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
  items = [];
}

export function loadNotifyFlashes(): NotifyFlashItem[] {
  return cloneItems();
}

/**
 * Show a reminder bar. Replaces any current bar (one item max) so persistent
 * mode cannot stack a viewport of banners.
 */
export function showNotifyFlash(text: string, opts?: ShowNotifyFlashOpts): string {
  clearAll();
  const persist = opts?.persist === true;
  const id = String(++seq);
  items = [{ id, text, shownAtMs: Date.now(), persist }];
  if (!persist) {
    const timer = setTimeout(() => {
      dismissNotifyFlash(id);
    }, NOTIFY_FLASH_DURATION_MS);
    timers.set(id, timer);
  }
  emit();
  return id;
}

export function dismissNotifyFlash(id: string): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = items.filter((row) => row.id !== id);
  if (next.length === items.length) {
    return;
  }
  items = next;
  emit();
}

/** Test helper. */
export function resetNotifyFlashForTests(): void {
  clearAll();
  seq = 0;
}
