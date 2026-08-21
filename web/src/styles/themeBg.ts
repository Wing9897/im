/**
 * Theme background modes: none | custom (upload) | focal (Bing daily).
 * Custom images stay in per-theme localStorage; focal URL is day+idx cached.
 * Apply paints via CSS vars on ``html`` (see ``applyBgImage`` / theme-textures.css).
 */

import {
  THEME_FOCAL_CACHE_KEY,
  THEME_FOCAL_REFRESH_HOURS_KEY,
  storageBgKey,
  storageBgModeKey,
  storageBgOpacityKey,
} from "../domain/prefs";
import {
  fetchFocalBackground,
  fetchFocalBackgroundImage,
  type FocalBackground,
} from "../api/theme";
import { getAppLocale } from "../i18n/locale";
import { resolveThemeId } from "./themeCatalog";

export type ThemeBgMode = "none" | "custom" | "focal";

/** Allowed auto-refresh intervals (hours). ``0`` = off. */
export const FOCAL_REFRESH_HOUR_OPTIONS = [0, 1, 6, 12, 24] as const;
export type FocalRefreshHours = (typeof FOCAL_REFRESH_HOUR_OPTIONS)[number];

export const FOCAL_IDX_MIN = 0;
export const FOCAL_IDX_MAX = 7;

export type FocalCacheEntry = {
  day: string;
  locale: string;
  imageUrl: string;
  title?: string | null;
  copyright?: string | null;
  /** Bing archive idx used for this entry (0=today … 7). */
  idx?: number;
  /** Epoch ms when this entry was fetched (for interval refresh). */
  fetchedAt?: number;
};

const THEME_BG_MODES = new Set<ThemeBgMode>(["none", "custom", "focal"]);
const REFRESH_HOURS_SET = new Set<number>(FOCAL_REFRESH_HOUR_OPTIONS);

const MISSING_STORAGE: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/**
 * `localStorage` as a default-arg identifier throws ReferenceError after Vitest
 * jsdom teardown; `typeof` is safe for an undeclared global.
 */
function themeStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  if (typeof localStorage === "undefined") return MISSING_STORAGE;
  return localStorage;
}

/** Escape a URL for use inside CSS ``url("...")``. */
export function cssBackgroundImageUrl(url: string): string {
  const escaped = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

/**
 * Convert photo opacity (0.05–0.6) → surface wash % for color-mix.
 * Higher opacity → lower wash → stronger photo.
 * Bias −8pp vs raw inverse so frosted panels stay readable over the photo
 * (raw 70% wash at default opacity made resting glass look cardboard).
 * Floor 40% so bright photos cannot punch through UI chrome.
 */
export function themeBgWashPct(opacity: number): string {
  const o = Number.isFinite(opacity) ? opacity : 0.3;
  const clamped = Math.min(0.6, Math.max(0.05, o));
  const pct = Math.round((1 - clamped) * 100) - 8;
  return `${Math.min(90, Math.max(40, pct))}%`;
}

let _focalObjectUrl: string | null = null;

/** Revoke prior focal blob URL; adopt ``next`` (or clear when null). */
export function adoptFocalObjectUrl(next: string | null): string | null {
  if (_focalObjectUrl && _focalObjectUrl !== next) {
    URL.revokeObjectURL(_focalObjectUrl);
  }
  _focalObjectUrl = next;
  return _focalObjectUrl;
}

/** Pure parse: invalid / empty → null (caller applies legacy fallback). */
export function parseThemeBgMode(raw: string | null | undefined): ThemeBgMode | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (THEME_BG_MODES.has(value as ThemeBgMode)) {
    return value as ThemeBgMode;
  }
  return null;
}

/**
 * Resolve persisted mode. Missing mode + existing custom image → custom
 * (backward compatible; no prefs stamp bump).
 */
export function resolveThemeBgMode(
  themeId: string,
  storage: Pick<Storage, "getItem"> = themeStorage(),
): ThemeBgMode {
  const id = resolveThemeId(themeId);
  const parsed = parseThemeBgMode(storage.getItem(storageBgModeKey(id)));
  if (parsed) return parsed;
  const hasCustom = Boolean(storage.getItem(storageBgKey(id)));
  return hasCustom ? "custom" : "none";
}

export function saveThemeBgMode(themeId: string, mode: ThemeBgMode): void {
  const id = resolveThemeId(themeId);
  themeStorage().setItem(storageBgModeKey(id), mode);
}

export function loadBgOpacity(themeId: string): number {
  const id = resolveThemeId(themeId);
  const raw = parseFloat(themeStorage().getItem(storageBgOpacityKey(id)) || "0.3");
  if (!Number.isFinite(raw)) return 0.3;
  return Math.min(0.6, Math.max(0.05, raw));
}

export function utcDayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function clampFocalIdx(idx: number | null | undefined): number {
  if (idx == null || !Number.isFinite(idx)) return FOCAL_IDX_MIN;
  return Math.max(FOCAL_IDX_MIN, Math.min(FOCAL_IDX_MAX, Math.trunc(idx)));
}

/** Next Bing archive idx in the 0–7 cycle (manual / interval “换一张”). */
export function nextFocalIdx(current: number | null | undefined): number {
  return (clampFocalIdx(current) + 1) % (FOCAL_IDX_MAX + 1);
}

export function parseFocalRefreshHours(
  raw: string | null | undefined,
): FocalRefreshHours {
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || !REFRESH_HOURS_SET.has(n)) return 0;
  return n as FocalRefreshHours;
}

export function loadFocalRefreshHours(
  storage: Pick<Storage, "getItem"> = themeStorage(),
): FocalRefreshHours {
  return parseFocalRefreshHours(storage.getItem(THEME_FOCAL_REFRESH_HOURS_KEY));
}

export function saveFocalRefreshHours(hours: FocalRefreshHours): void {
  const normalized = parseFocalRefreshHours(String(hours));
  if (normalized === 0) {
    themeStorage().removeItem(THEME_FOCAL_REFRESH_HOURS_KEY);
    return;
  }
  themeStorage().setItem(THEME_FOCAL_REFRESH_HOURS_KEY, String(normalized));
}

export function loadFocalCache(
  storage: Pick<Storage, "getItem"> = themeStorage(),
): FocalCacheEntry | null {
  const raw = storage.getItem(THEME_FOCAL_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FocalCacheEntry>;
    if (
      typeof parsed.day === "string" &&
      typeof parsed.locale === "string" &&
      typeof parsed.imageUrl === "string" &&
      parsed.imageUrl.length > 0
    ) {
      const idx =
        typeof parsed.idx === "number" && Number.isFinite(parsed.idx)
          ? clampFocalIdx(parsed.idx)
          : FOCAL_IDX_MIN;
      const fetchedAt =
        typeof parsed.fetchedAt === "number" && Number.isFinite(parsed.fetchedAt)
          ? parsed.fetchedAt
          : undefined;
      return {
        day: parsed.day,
        locale: parsed.locale,
        imageUrl: parsed.imageUrl,
        title: typeof parsed.title === "string" ? parsed.title : null,
        copyright: typeof parsed.copyright === "string" ? parsed.copyright : null,
        idx,
        fetchedAt,
      };
    }
  } catch {
    // ignore corrupt cache
  }
  return null;
}

export function saveFocalCache(entry: FocalCacheEntry): void {
  themeStorage().setItem(THEME_FOCAL_CACHE_KEY, JSON.stringify(entry));
}

export function clearFocalCache(
  storage: Pick<Storage, "removeItem"> = themeStorage(),
): void {
  storage.removeItem(THEME_FOCAL_CACHE_KEY);
}

export function focalCacheToEntry(
  data: FocalBackground,
  locale: string,
  day = utcDayIso(),
  idx = FOCAL_IDX_MIN,
  fetchedAt = Date.now(),
): FocalCacheEntry {
  return {
    day,
    locale,
    imageUrl: data.imageUrl,
    title: data.title ?? null,
    copyright: data.copyright ?? null,
    idx: clampFocalIdx(idx),
    fetchedAt,
  };
}

/** Apply cached focal URL when still today + same locale; else any last URL for offline. */
export function pickFocalUrlForApply(
  cache: FocalCacheEntry | null,
  locale: string,
  day = utcDayIso(),
): string | null {
  if (!cache?.imageUrl) return null;
  if (cache.day === day && cache.locale === locale) return cache.imageUrl;
  // Stale / other locale — still usable as last-successful fallback.
  return cache.imageUrl;
}

/** True when an interval refresh is due (or cache has no fetchedAt). */
export function isFocalRefreshDue(
  cache: FocalCacheEntry | null,
  hours: FocalRefreshHours,
  now = Date.now(),
): boolean {
  if (hours <= 0) return false;
  if (!cache) return true;
  const fetchedAt = cache.fetchedAt;
  if (fetchedAt == null || !Number.isFinite(fetchedAt)) return true;
  return now - fetchedAt >= hours * 3_600_000;
}

let _focalFetchInFlight: Promise<FocalCacheEntry | null> | null = null;
let _focalImageInFlight: Promise<string | null> | null = null;
let _focalFetchKey: string | null = null;
let _focalImageKey: string | null = null;

export type RefreshFocalOptions = {
  locale?: string;
  /** Explicit Bing archive idx (0–7). */
  idx?: number;
  /** When true, clear client cache before fetch (still uses ``idx``). */
  force?: boolean;
};

/**
 * Fetch Bing wallpaper via server proxy; update day+idx cache.
 * Concurrent callers with the same locale+idx share one in-flight promise.
 */
export async function refreshFocalBackground(
  localeOrOptions: string | RefreshFocalOptions = getAppLocale(),
): Promise<FocalCacheEntry | null> {
  const options: RefreshFocalOptions =
    typeof localeOrOptions === "string"
      ? { locale: localeOrOptions }
      : localeOrOptions;
  const locale = options.locale ?? getAppLocale();
  const cache = loadFocalCache();
  const idx = clampFocalIdx(
    options.idx ?? (cache?.day === utcDayIso() && cache.locale === locale ? cache.idx : 0),
  );
  const key = `${locale}|${idx}`;

  if (options.force) {
    clearFocalCache();
  }

  if (_focalFetchInFlight && _focalFetchKey === key && !options.force) {
    return _focalFetchInFlight;
  }

  _focalFetchKey = key;
  _focalFetchInFlight = (async () => {
    try {
      const data = await fetchFocalBackground({ locale, idx });
      const entry = focalCacheToEntry(data, locale, utcDayIso(), idx);
      saveFocalCache(entry);
      return entry;
    } catch (err) {
      // Keep UI soft-fail (motif / last cache); log for local npm run dev diagnosis.
      console.warn("[theme] focal background refresh failed", err);
      return null;
    } finally {
      _focalFetchInFlight = null;
      _focalFetchKey = null;
    }
  })();
  return _focalFetchInFlight;
}

/**
 * Advance to the next Bing archive idx (0→1→…→7→0), fetch, and cache.
 * Used by Settings “Refresh” and timed auto-update.
 */
export async function advanceFocalBackground(
  locale: string = getAppLocale(),
): Promise<FocalCacheEntry | null> {
  const cache = loadFocalCache();
  const day = utcDayIso();
  const baseIdx =
    cache && cache.day === day && cache.locale === locale ? cache.idx : FOCAL_IDX_MIN;
  const idx = nextFocalIdx(baseIdx);
  return refreshFocalBackground({ locale, idx, force: true });
}

/**
 * Resolve a URL suitable for ``applyBgImage`` in focal mode.
 * Prefers same-origin blob bytes (auth proxy); falls back to Bing hotlink.
 */
export async function materializeFocalApplyUrl(
  localeOrOptions: string | RefreshFocalOptions = getAppLocale(),
): Promise<string | null> {
  const options: RefreshFocalOptions =
    typeof localeOrOptions === "string"
      ? { locale: localeOrOptions }
      : localeOrOptions;
  const locale = options.locale ?? getAppLocale();
  const cache = loadFocalCache();
  const idx = clampFocalIdx(
    options.idx ??
      (cache?.day === utcDayIso() && cache.locale === locale ? cache.idx : FOCAL_IDX_MIN),
  );
  const key = `${locale}|${idx}|${options.force ? "f" : "n"}`;

  if (_focalImageInFlight && _focalImageKey === key) {
    return _focalImageInFlight;
  }

  _focalImageKey = key;
  _focalImageInFlight = (async () => {
    try {
      const entry = await refreshFocalBackground({
        locale,
        idx,
        force: options.force,
      });
      const bingUrl =
        entry?.imageUrl ?? pickFocalUrlForApply(loadFocalCache(), locale, utcDayIso());
      if (!bingUrl) return null;
      try {
        const blob = await fetchFocalBackgroundImage({ locale, idx });
        if (!blob || blob.size === 0) return bingUrl;
        return adoptFocalObjectUrl(URL.createObjectURL(blob)) ?? bingUrl;
      } catch (err) {
        console.warn("[theme] focal image proxy failed; using Bing URL", err);
        return bingUrl;
      }
    } finally {
      _focalImageInFlight = null;
      _focalImageKey = null;
    }
  })();
  return _focalImageInFlight;
}

/**
 * Advance idx, materialize blob URL, and return both for callers that apply BG.
 */
export async function advanceAndMaterializeFocal(
  locale: string = getAppLocale(),
): Promise<{ entry: FocalCacheEntry | null; applyUrl: string | null }> {
  const cache = loadFocalCache();
  const day = utcDayIso();
  const baseIdx =
    cache && cache.day === day && cache.locale === locale ? cache.idx : FOCAL_IDX_MIN;
  const idx = nextFocalIdx(baseIdx);
  const applyUrl = await materializeFocalApplyUrl({ locale, idx, force: true });
  return { entry: loadFocalCache(), applyUrl };
}
