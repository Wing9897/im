import { createElement, type ReactElement, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { setAppLocale } from "../i18n";

/**
 * Shared test harness for UI that needs react-i18next + zh-Hant defaults.
 * Prefer this over per-file I18nextProvider / setAppLocale("zh-Hant") copies.
 */
export { i18n };

export async function ensureZhHantLocale(): Promise<void> {
  setAppLocale("zh-Hant");
  if (i18n.language !== "zh-Hant") {
    await i18n.changeLanguage("zh-Hant");
  }
}

export function wrapWithI18n(node: ReactNode): ReactElement {
  return createElement(I18nextProvider, { i18n }, node);
}
