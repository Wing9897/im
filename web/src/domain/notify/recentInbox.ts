/**
 * Rolling 24h reminder inbox (shell drawer). Shared with the scanner so
 * announced / flashed rows and the badge use the same entries.
 *
 * Dismiss / clear-all only hide inbox rows (and the bell badge). They do not
 * delete calendar events, and they do not clear fired keys — those stay so
 * the scanner will not re-speak. A dismissed-id set in this same local store
 * keeps cleared rows from reappearing if append is called again.
 */

export const RECENT_INBOX_CHANGED_EVENT = "im:notify-recent-inbox-changed";
export const RECENT_INBOX_OPEN_EVENT = "im:notify-recent-inbox-open";

const STORAGE_KEY = "im.notify.recentInbox";
const RETAIN_MS = 24 * 60 * 60_000;

export type RecentInboxEntry = {
  dedupeKey: string;
  eventId: string;
  title: string;
  startTime: string;
  remindAtMs: number;
  announcedAtMs: number;
  read: boolean;
};

type DismissedInboxId = {
  dedupeKey: string;
  dismissedAtMs: number;
};

type InboxState = {
  entries: RecentInboxEntry[];
  dismissed: DismissedInboxId[];
};

let cached: InboxState | null = null;
let inboxOpen = false;

function cloneEntries(rows: readonly RecentInboxEntry[]): RecentInboxEntry[] {
  return rows.map((row) => ({ ...row }));
}

function cloneDismissed(rows: readonly DismissedInboxId[]): DismissedInboxId[] {
  return rows.map((row) => ({ ...row }));
}

function cloneState(state: InboxState): InboxState {
  return {
    entries: cloneEntries(state.entries),
    dismissed: cloneDismissed(state.dismissed),
  };
}

function pruneEntries(rows: readonly RecentInboxEntry[], nowMs: number): RecentInboxEntry[] {
  const floor = nowMs - RETAIN_MS;
  return rows.filter((row) => row.announcedAtMs >= floor || row.remindAtMs >= floor);
}

function pruneDismissed(rows: readonly DismissedInboxId[], nowMs: number): DismissedInboxId[] {
  const floor = nowMs - RETAIN_MS;
  return rows.filter((row) => row.dismissedAtMs >= floor);
}

function dismissedKeySet(rows: readonly DismissedInboxId[]): Set<string> {
  return new Set(rows.map((row) => row.dedupeKey));
}

function rememberDismissed(
  dismissed: readonly DismissedInboxId[],
  keys: readonly string[],
  nowMs: number,
): DismissedInboxId[] {
  const next = cloneDismissed(dismissed);
  const seen = dismissedKeySet(next);
  for (const dedupeKey of keys) {
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    next.push({ dedupeKey, dismissedAtMs: nowMs });
    seen.add(dedupeKey);
  }
  return pruneDismissed(next, nowMs);
}

function persist(state: InboxState): void {
  cached = cloneState(state);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Quota / private mode — keep memory cache.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RECENT_INBOX_CHANGED_EVENT));
  }
}

function parseEntries(raw: unknown): RecentInboxEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentInboxEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<RecentInboxEntry>;
    if (typeof row.dedupeKey !== "string" || !row.dedupeKey) continue;
    if (typeof row.title !== "string") continue;
    out.push({
      dedupeKey: row.dedupeKey,
      eventId: typeof row.eventId === "string" ? row.eventId : "",
      title: row.title,
      startTime: typeof row.startTime === "string" ? row.startTime : "",
      remindAtMs: typeof row.remindAtMs === "number" ? row.remindAtMs : 0,
      announcedAtMs: typeof row.announcedAtMs === "number" ? row.announcedAtMs : 0,
      read: Boolean(row.read),
    });
  }
  return out;
}

function parseDismissed(raw: unknown): DismissedInboxId[] {
  if (!Array.isArray(raw)) return [];
  const out: DismissedInboxId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item === "string" && item && !seen.has(item)) {
      out.push({ dedupeKey: item, dismissedAtMs: 0 });
      seen.add(item);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<DismissedInboxId>;
    if (typeof row.dedupeKey !== "string" || !row.dedupeKey || seen.has(row.dedupeKey)) {
      continue;
    }
    out.push({
      dedupeKey: row.dedupeKey,
      dismissedAtMs: typeof row.dismissedAtMs === "number" ? row.dismissedAtMs : 0,
    });
    seen.add(row.dedupeKey);
  }
  return out;
}

function readStorage(): InboxState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [], dismissed: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return { entries: parseEntries(parsed), dismissed: [] };
    }
    if (!parsed || typeof parsed !== "object") {
      return { entries: [], dismissed: [] };
    }
    const bag = parsed as { entries?: unknown; dismissed?: unknown };
    return {
      entries: parseEntries(bag.entries),
      dismissed: parseDismissed(bag.dismissed),
    };
  } catch {
    return { entries: [], dismissed: [] };
  }
}

function loadState(nowMs: number): InboxState {
  if (!cached) {
    cached = readStorage();
  }
  const dismissed = pruneDismissed(cached.dismissed, nowMs);
  const hidden = dismissedKeySet(dismissed);
  const entries = pruneEntries(cached.entries, nowMs).filter((row) => !hidden.has(row.dedupeKey));
  if (
    entries.length !== cached.entries.length ||
    dismissed.length !== cached.dismissed.length
  ) {
    persist({ entries, dismissed });
  }
  return cloneState({ entries, dismissed });
}

/** Sync snapshot of visible (non-dismissed) rows, pruned to 24h. */
export function loadRecentInbox(nowMs: number = Date.now()): RecentInboxEntry[] {
  return cloneEntries(loadState(nowMs).entries);
}

/** Dismissed inbox ids still blocking re-insert (pruned to 24h). */
export function loadRecentInboxDismissedKeys(nowMs: number = Date.now()): string[] {
  return loadState(nowMs).dismissed.map((row) => row.dedupeKey);
}

export function unreadRecentInboxCount(nowMs: number = Date.now()): number {
  return loadRecentInbox(nowMs).filter((row) => !row.read).length;
}

/** Insert or refresh a just-fired reminder. Existing / dismissed keys stay hidden (no dupes). */
export function appendRecentInbox(
  entry: Omit<RecentInboxEntry, "read" | "announcedAtMs"> & {
    announcedAtMs?: number;
    read?: boolean;
  },
  nowMs: number = Date.now(),
): void {
  const state = loadState(nowMs);
  if (state.entries.some((row) => row.dedupeKey === entry.dedupeKey)) {
    return;
  }
  if (dismissedKeySet(state.dismissed).has(entry.dedupeKey)) {
    return;
  }
  state.entries.unshift({
    dedupeKey: entry.dedupeKey,
    eventId: entry.eventId,
    title: entry.title,
    startTime: entry.startTime,
    remindAtMs: entry.remindAtMs,
    announcedAtMs: entry.announcedAtMs ?? nowMs,
    // Drawer already open: user can see the row; don't bump the badge.
    read: entry.read ?? isRecentInboxOpen(),
  });
  persist({
    entries: pruneEntries(state.entries, nowMs),
    dismissed: state.dismissed,
  });
}

/** Hide one inbox row. Fired keys / calendar events are untouched. */
export function dismissRecentInboxEntry(dedupeKey: string, nowMs: number = Date.now()): void {
  if (!dedupeKey) return;
  const state = loadState(nowMs);
  const entries = state.entries.filter((row) => row.dedupeKey !== dedupeKey);
  persist({
    entries,
    dismissed: rememberDismissed(state.dismissed, [dedupeKey], nowMs),
  });
}

/** Hide every visible inbox row (badge included). Fired keys / calendar events stay. */
export function clearRecentInbox(nowMs: number = Date.now()): void {
  const state = loadState(nowMs);
  persist({
    entries: [],
    dismissed: rememberDismissed(
      state.dismissed,
      state.entries.map((row) => row.dedupeKey),
      nowMs,
    ),
  });
}

export function markRecentInboxRead(nowMs: number = Date.now()): void {
  const state = loadState(nowMs);
  persist({
    entries: state.entries.map((row) => ({ ...row, read: true })),
    dismissed: state.dismissed,
  });
}

export function isRecentInboxOpen(): boolean {
  return inboxOpen;
}

export function setRecentInboxOpen(open: boolean): void {
  inboxOpen = open;
  if (open) {
    markRecentInboxRead();
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RECENT_INBOX_OPEN_EVENT));
    window.dispatchEvent(new Event(RECENT_INBOX_CHANGED_EVENT));
  }
}

/** Test helper. */
export function resetRecentInboxForTests(): void {
  cached = null;
  inboxOpen = false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
