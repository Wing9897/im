import i18n from "./i18n";

/**
 * Lightweight `{name}` template formatter backed by i18next resources when
 * `template` is a known key (`messages.*` / dotted path); otherwise substitutes
 * placeholders in the raw template string.
 */
export function formatMessage(
  template: string,
  vars: Record<string, string | number | null | undefined> = {},
): string {
  const cleaned: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined && value !== null) cleaned[key] = value;
  }

  if (template.includes(".") && i18n.exists(template)) {
    return i18n.t(template, cleaned);
  }

  // Legacy / inline templates: substitute `{name}` placeholders.
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = cleaned[key];
    if (value === undefined) return match;
    return String(value);
  });
}

/** Locale-aware list separator (`common:ui.listSep`: `、` / `, `). */
export function getListSeparator(): string {
  return String(i18n.t("ui.listSep"));
}

/** Join non-empty parts with {@link getListSeparator}. */
export function joinList(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(getListSeparator());
}
