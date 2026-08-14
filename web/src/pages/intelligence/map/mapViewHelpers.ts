import type { TFunction } from "i18next";
import type { Message } from "../../../types";
import type { DanmakuMode } from "../../../domain/intelligence/mapViewStorage";
import {
  MAP_LIVE_MODE_STORAGE_KEY,
  MAP_TIME_WINDOW_STORAGE_KEY,
  SHARED_DANMAKU_MODE_KEY,
} from "../../../domain/prefs";

export { CARTO_URL, CARTO_ATTR } from "../../../domain/intelligence/mapTiles";
export {
  parsePersistedMapTimeWindow,
  readSharedDanmakuMode,
  readStoredMapTimeWindow,
  serializeMapTimeWindow,
  writeStoredMapTimeWindow,
  type DanmakuMode,
  type PersistedMapTimeWindow,
} from "../../../domain/intelligence/mapViewStorage";

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

export {
  MAP_LIVE_MODE_STORAGE_KEY,
  MAP_TIME_WINDOW_STORAGE_KEY,
  SHARED_DANMAKU_MODE_KEY,
};

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
