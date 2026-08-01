import { useEffect, useState } from "react";
import {
  listBrowserTtsVoices,
  toBrowserTtsVoiceOptions,
  whenBrowserTtsVoicesReady,
  type BrowserTtsVoiceOption,
} from "./browserTtsVoices";
import i18n from "../i18n";

/** Reactive list of browser TTS voices (handles Chrome `voiceschanged`). */
export function useBrowserTtsVoiceOptions(speechLanguage: string): BrowserTtsVoiceOption[] {
  const [options, setOptions] = useState<BrowserTtsVoiceOption[]>(() =>
    toBrowserTtsVoiceOptions(listBrowserTtsVoices(), speechLanguage, (key) =>
      String(i18n.t(key)),
    ),
  );

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      setOptions(
        toBrowserTtsVoiceOptions(listBrowserTtsVoices(), speechLanguage, (key) =>
          String(i18n.t(key)),
        ),
      );
    };
    void whenBrowserTtsVoicesReady().then(refresh);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.addEventListener("voiceschanged", refresh);
    }
    return () => {
      cancelled = true;
      window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
    };
  }, [speechLanguage]);

  return options;
}
