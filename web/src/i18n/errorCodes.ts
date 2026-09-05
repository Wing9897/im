import i18n from "./i18n";

/** Resolve a known error code to localized copy, or `undefined` if unmapped. */
export function messageForErrorCode(
  code: string | null | undefined,
): string | undefined {
  if (!code) return undefined;
  const key = `errors.${code}`;
  if (i18n.exists(key)) return i18n.t(key);
  const lower = `errors.${code.toLowerCase()}`;
  if (lower !== key && i18n.exists(lower)) return i18n.t(lower);
  return undefined;
}

/** True when `message` is the code itself or the localized copy for that code. */
export function errorMatchesCode(message: string, code: string): boolean {
  if (!message || !code) return false;
  if (message === code || message.includes(code)) return true;
  const copy = messageForErrorCode(code);
  return Boolean(copy && (message === copy || message.includes(copy)));
}
