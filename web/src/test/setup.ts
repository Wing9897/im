import { act } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import i18n from "../i18n";
import { setAppLocale } from "../i18n/locale";

// Enable React 18 act() in jsdom (avoids "not configured to support act" warnings).
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// jsdom does not implement matchMedia — SkeletonScreen and others need it.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  setAppLocale("zh-Hant");
  if (i18n.language !== "zh-Hant") {
    void i18n.changeLanguage("zh-Hant");
  }
});

afterEach(() => {
  // Clear while fake timers are still installed; useRealTimers first would drop them.
  vi.clearAllTimers();
  vi.useRealTimers();
});

void act;
