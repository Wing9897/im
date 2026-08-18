/**
 * Theme helpers — focal / daily background via server Bing proxy.
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";

export type FocalBackground = components["schemas"]["FocalBackgroundResponse"];

export type FocalBackgroundQuery = {
  locale?: string;
  /** Bing HPImageArchive idx: 0=today … 7 (recent days). */
  idx?: number;
};

function focalQueryParams(query?: FocalBackgroundQuery): Record<string, string> | undefined {
  if (!query) return undefined;
  const params: Record<string, string> = {};
  if (query.locale) params.locale = query.locale;
  if (query.idx != null && Number.isFinite(query.idx)) {
    params.idx = String(Math.max(0, Math.min(7, Math.trunc(query.idx))));
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

/** Server proxies Bing HPImageArchive JSON (avoids browser CORS). */
export function fetchFocalBackground(
  localeOrQuery?: string | FocalBackgroundQuery,
): Promise<FocalBackground> {
  const query: FocalBackgroundQuery | undefined =
    typeof localeOrQuery === "string" ? { locale: localeOrQuery } : localeOrQuery;
  return apiClient.get<FocalBackground>(
    "/api/v1/theme/focal-background",
    focalQueryParams(query),
  );
}

/** Server proxies Bing wallpaper bytes (auth header; for blob CSS apply). */
export function fetchFocalBackgroundImage(
  localeOrQuery?: string | FocalBackgroundQuery,
): Promise<Blob> {
  const query: FocalBackgroundQuery | undefined =
    typeof localeOrQuery === "string" ? { locale: localeOrQuery } : localeOrQuery;
  const params = focalQueryParams(query);
  // Keep a static `/image` path prefix (optional `?...` after `?`) so route-inventory
  // scanners do not treat `${…}` as a path parameter glued onto `image`.
  const path = params
    ? `/api/v1/theme/focal-background/image?${new URLSearchParams(params).toString()}`
    : "/api/v1/theme/focal-background/image";
  return apiClient.getBlob(path, {
    timeoutMs: 20_000,
  });
}
