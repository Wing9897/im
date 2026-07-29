import { UI_LOCALE_STORAGE_KEY } from "./localePersistedKeys";

/** UI locale token (resolved / concrete). */
export type AppLocale = "zh-Hant" | "zh-Hans" | "en";

/** Stored UI language preference (manual lock or follow browser). */
export type AppLocalePreference = "auto" | AppLocale;

const STORAGE_KEY = UI_LOCALE_STORAGE_KEY;
const DEFAULT_LOCALE: AppLocale = "zh-Hant";
const DEFAULT_PREFERENCE: AppLocalePreference = "zh-Hant";

const DATE_TIME_LOCALE: Record<AppLocale, string> = {
  "zh-Hant": "zh-TW",
  "zh-Hans": "zh-CN",
  en: "en-US",
};

type LocaleListener = (locale: AppLocale) => void;
const localeListeners = new Set<LocaleListener>();

/** Register a listener invoked when the effective locale changes (i18next bridge). */
export function onAppLocaleChange(listener: LocaleListener): () => void {
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
}

function isAppLocale(value: string): value is AppLocale {
  return value === "zh-Hant" || value === "zh-Hans" || value === "en";
}

function isAppLocalePreference(value: string): value is AppLocalePreference {
  return value === "auto" || isAppLocale(value);
}

function readNavigatorLanguage(override?: string): string {
  if (override !== undefined) return override;
  if (typeof navigator === "undefined") return "";
  return navigator.language ?? "";
}

/**
 * Map preference → concrete locale.
 * When `auto`, derive from `navigator.language` (or override):
 * - zh-TW / zh-HK / zh-MO / zh-Hant → zh-Hant
 * - zh-CN / zh-SG / zh-Hans → zh-Hans
 * - other zh* → zh-Hant
 * - non-zh → en
 */
export function resolveAppLocale(
  pref: AppLocalePreference,
  navigatorLanguage?: string,
): AppLocale {
  if (pref !== "auto") return pref;

  const raw = readNavigatorLanguage(navigatorLanguage).trim();
  if (!raw) return DEFAULT_LOCALE;

  const normalized = raw.toLowerCase().replace(/_/g, "-");

  if (
    normalized === "zh-hans" ||
    normalized.startsWith("zh-hans-") ||
    normalized === "zh-cn" ||
    normalized.startsWith("zh-cn-") ||
    normalized === "zh-sg" ||
    normalized.startsWith("zh-sg-")
  ) {
    return "zh-Hans";
  }

  if (
    normalized === "zh-hant" ||
    normalized.startsWith("zh-hant-") ||
    normalized === "zh-tw" ||
    normalized.startsWith("zh-tw-") ||
    normalized === "zh-hk" ||
    normalized.startsWith("zh-hk-") ||
    normalized === "zh-mo" ||
    normalized.startsWith("zh-mo-")
  ) {
    return "zh-Hant";
  }

  if (normalized === "zh" || normalized.startsWith("zh-")) {
    return "zh-Hant";
  }

  return "en";
}

/** Stored preference (`auto` or a concrete locale). Existing concrete values = manual lock. */
export function getAppLocalePreference(): AppLocalePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isAppLocalePreference(raw)) return raw;
  } catch {
    // ignore (SSR / blocked storage)
  }
  return DEFAULT_PREFERENCE;
}

/** Current effective app UI locale (resolves `auto` from the browser). */
export function getAppLocale(): AppLocale {
  return resolveAppLocale(getAppLocalePreference());
}

function notifyLocaleListeners(locale: AppLocale): void {
  applyDocumentLang(locale);
  for (const listener of localeListeners) {
    listener(locale);
  }
}

/**
 * Best-effort write of UI locale to server settings for background analysis.
 * localStorage remains the live UI source of truth; failures are ignored.
 * Server always receives a concrete locale — never `"auto"`.
 */
export function persistUiLocaleToServer(locale: AppLocale): void {
  void import("../api/config")
    .then(({ saveSystemSettings }) => saveSystemSettings({ uiLocale: locale }))
    .catch(() => {
      // ignore — UI already updated locally
    });
}

/** Persist preference, apply resolved locale, notify i18n, sync concrete locale to server. */
export function setAppLocalePreference(pref: AppLocalePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // ignore
  }
  const resolved = resolveAppLocale(pref);
  notifyLocaleListeners(resolved);
  persistUiLocaleToServer(resolved);
}

/**
 * Persist a concrete UI locale as a manual lock (back-compat).
 * Equivalent to `setAppLocalePreference(locale)`.
 */
export function setAppLocale(locale: AppLocale): void {
  setAppLocalePreference(locale);
}

/** Re-resolve when preference is `auto` (browser `languagechange`). */
function handleLanguageChange(): void {
  if (getAppLocalePreference() !== "auto") return;
  const resolved = resolveAppLocale("auto");
  notifyLocaleListeners(resolved);
  persistUiLocaleToServer(resolved);
}

if (typeof window !== "undefined") {
  window.addEventListener("languagechange", handleLanguageChange);
}

/** BCP-47 tag for `Intl` / `localeCompare` (e.g. zh-Hant → zh-TW). */
export function getDateTimeLocale(): string {
  return DATE_TIME_LOCALE[getAppLocale()];
}

/** Set `<html lang>` from the active app locale. */
export function applyDocumentLang(locale: AppLocale = getAppLocale()): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

export const APP_LOCALES: readonly AppLocale[] = ["zh-Hant", "zh-Hans", "en"];

export const APP_LOCALE_PREFERENCES: readonly AppLocalePreference[] = [
  "auto",
  "zh-Hant",
  "zh-Hans",
  "en",
];

/** `common:language.*` label keys for {@link APP_LOCALE_PREFERENCES}. */
export const APP_LOCALE_PREFERENCE_LABEL_KEYS: Record<AppLocalePreference, string> = {
  auto: "language.auto",
  "zh-Hant": "language.zhHant",
  "zh-Hans": "language.zhHans",
  en: "language.en",
};
