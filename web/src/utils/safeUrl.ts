// ============================================================
// Safe URL Validation
// ============================================================
//
// Centralized URL protocol allowlist used when rendering external URLs
// in `href` / `src` attributes, or when forwarding user-supplied URLs
// to backend commands. Rejects `javascript:`, `data:`, `vbscript:`,
// `file:`, and other unsafe schemes that could lead to XSS or
// information disclosure.

/** Protocols allowed when rendering external links. */
const SAFE_HTTP_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

/**
 * Returns true when `value` is a syntactically valid URL whose scheme is
 * in the http / https allowlist. All other schemes (including
 * `javascript:`, `data:`, `vbscript:`, `file:`, relative URLs) return
 * false.
 */
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return SAFE_HTTP_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}
