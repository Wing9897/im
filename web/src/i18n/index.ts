/**
 * Public i18n surface: prefer this barrel for new imports.
 *
 * - Preference vs effective locale: `getAppLocalePreference` / `setAppLocalePreference`
 *   vs `getAppLocale` / `setAppLocale` (concrete lock; alias of preference setter).
 * - Templates: `formatMessage`, `joinList`, `messageKeys`.
 * - Errors: `messageForErrorCode`.
 * - Instance: default export is the configured `i18next` instance.
 */
export { default, defaultNS, resources, NAMESPACES } from "./i18n";
export {
  APP_LOCALES,
  APP_LOCALE_PREFERENCES,
  APP_LOCALE_PREFERENCE_LABEL_KEYS,
  applyDocumentLang,
  getAppLocale,
  getAppLocalePreference,
  getDateTimeLocale,
  onAppLocaleChange,
  persistUiLocaleToServer,
  resolveAppLocale,
  setAppLocale,
  setAppLocalePreference,
  type AppLocale,
  type AppLocalePreference,
} from "./locale";
export { formatMessage, getListSeparator, joinList } from "./formatMessage";
export { messageForErrorCode } from "./errorCodes";
export * from "./messageKeys";
