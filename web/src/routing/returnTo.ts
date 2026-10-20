/**
 * Same-origin return path for full-page editors.
 * Accept only a single leading slash. Protocol-relative (`//`) and backslash
 * forms are rejected so a query value cannot leave the app.
 */

import { normalizeLegacyPath } from "./legacyPaths";

export function isSafeReturnTo(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  if (value.includes("://")) return false;
  if (/[\u0000-\u001F\u007F]/.test(value)) return false;
  return true;
}

/** Read `returnTo` from a location search string. Unsafe or missing values use fallback. */
export function readReturnTo(search: string, fallback: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const value = new URLSearchParams(raw).get("returnTo")?.trim() ?? "";
  if (!value || !isSafeReturnTo(value)) return fallback;
  return normalizeLegacyPath(value);
}

/** Append a safe `returnTo` query. An unsafe back path leaves `path` unchanged. */
export function withReturnTo(path: string, back: string): string {
  if (!isSafeReturnTo(back)) return path;
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "");
  params.set("returnTo", back);
  const qs = params.toString();
  return `${pathname}?${qs}${hash}`;
}
