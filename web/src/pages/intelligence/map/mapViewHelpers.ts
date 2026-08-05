import type { TFunction } from "i18next";
import type { Message } from "../../../types";

export { CARTO_URL, CARTO_ATTR } from "../../../domain/intelligence/mapTiles";

export type DanmakuMode = "off" | "persistent" | "transient";
export type OverlayDisplayMode = "both" | "live-only" | "event-only";

export const ONE_HOUR = 3600_000;
export const LIVE_WINDOW_OPTIONS = [1, 3, 6, 12, 24, 72] as const;
export const MAX_RUNTIME_MESSAGES = 240;
export const EVENT_PANEL_MIN_HEIGHT = 140;
export const EVENT_PANEL_MAX_HEIGHT = 520;
export const LIVE_INFO_PANEL_MIN_HEIGHT = 120;
export const LIVE_INFO_PANEL_MAX_HEIGHT = 420;

export function clampHeight(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

import {
  MAP_LIVE_MODE_STORAGE_KEY,
  MAP_TIME_WINDOW_STORAGE_KEY,
  SHARED_DANMAKU_MODE_KEY,
} from "../../../domain/prefs";

export {
  MAP_LIVE_MODE_STORAGE_KEY,
  MAP_TIME_WINDOW_STORAGE_KEY,
  SHARED_DANMAKU_MODE_KEY,
};

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

export function sortMessagesDesc(items: Message[]): Message[] {
  return [...items].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export function cycleDanmakuMode(mode: DanmakuMode): DanmakuMode {
  return mode === "off" ? "persistent" : mode === "persistent" ? "transient" : "off";
}

export function cycleOverlayDisplayMode(mode: OverlayDisplayMode): OverlayDisplayMode {
  return mode === "both" ? "live-only" : mode === "live-only" ? "event-only" : "both";
}

export function danmakuModeLabel(t: TFunction, mode: DanmakuMode): string {
  return mode === "off"
    ? t("map.danmaku.off")
    : mode === "persistent"
      ? t("map.danmaku.persistent")
      : t("map.danmaku.transient");
}

export function overlayDisplayLabel(t: TFunction, mode: OverlayDisplayMode): string {
  return mode === "both"
    ? t("map.overlay.both")
    : mode === "live-only"
      ? t("map.overlay.liveOnly")
      : t("map.overlay.eventOnly");
}
