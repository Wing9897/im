import { SHARED_DANMAKU_MODE_KEY } from "../prefs";

export type DanmakuMode = "off" | "persistent" | "transient";

export interface PersistedMapTimeWindow {
  start: string;
  end: string;
}

export function serializeMapTimeWindow(window: { start: Date; end: Date }): PersistedMapTimeWindow {
  return { start: window.start.toISOString(), end: window.end.toISOString() };
}

export function parsePersistedMapTimeWindow(
  raw: unknown,
  fallback: { start: Date; end: Date },
): { start: Date; end: Date } {
  if (!raw || typeof raw !== "object") return fallback;
  const { start, end } = raw as PersistedMapTimeWindow;
  if (typeof start !== "string" || typeof end !== "string") return fallback;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return fallback;
  if (startDate.getTime() >= endDate.getTime()) return fallback;
  return { start: startDate, end: endDate };
}

export function readStoredMapTimeWindow(
  storageKey: string,
  fallback: { start: Date; end: Date },
): { start: Date; end: Date } {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === null) return fallback;
    return parsePersistedMapTimeWindow(JSON.parse(stored), fallback);
  } catch {
    return fallback;
  }
}

export function writeStoredMapTimeWindow(
  storageKey: string,
  timeWindow: { start: Date; end: Date },
): void {
  if (typeof globalThis.window === "undefined") return;
  try {
    globalThis.localStorage.setItem(
      storageKey,
      JSON.stringify(serializeMapTimeWindow(timeWindow)),
    );
  } catch {
    // ignore quota / private mode
  }
}

function isDanmakuMode(value: string | null): value is DanmakuMode {
  return value === "off" || value === "persistent" || value === "transient";
}

/** Read shared danmaku mode from localStorage (device chrome; not a migrate path). */
export function readSharedDanmakuMode(): DanmakuMode {
  if (typeof window === "undefined") return "persistent";
  const stored = window.localStorage.getItem(SHARED_DANMAKU_MODE_KEY);
  if (isDanmakuMode(stored)) return stored;
  return "persistent";
}
