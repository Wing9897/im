/** Browser `speechSynthesis` voice listing + resolution. */

export type BrowserTtsVoiceOption = {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  /** UI label: name + lang + local/remote hint */
  label: string;
};

const MAX_VOICE_URI_LEN = 512;

export function normalizeTtsVoiceUri(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, MAX_VOICE_URI_LEN);
}

export function listBrowserTtsVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}

/** BCP-47 prefix match (zh-HK matches zh-HK; en matches en-US). */
export function speechLangMatchesVoice(speechLanguage: string, voiceLang: string): boolean {
  const speech = speechLanguage.trim().toLowerCase();
  const voice = voiceLang.trim().toLowerCase();
  if (!speech || !voice) return false;
  if (speech === voice) return true;
  if (voice.startsWith(`${speech}-`) || speech.startsWith(`${voice}-`)) return true;
  const speechBase = speech.split("-")[0] ?? speech;
  const voiceBase = voice.split("-")[0] ?? voice;
  return speechBase === voiceBase;
}

export function formatBrowserTtsVoiceLabel(
  voice: SpeechSynthesisVoice,
  t?: (key: string) => string,
): string {
  const kind =
    voice.localService === true
      ? t?.("settings:voice.ttsVoiceKindLocal") ?? "local"
      : t?.("settings:voice.ttsVoiceKindRemote") ?? "remote";
  return `${voice.name} · ${voice.lang} · ${kind}`;
}

export function toBrowserTtsVoiceOptions(
  voices: readonly SpeechSynthesisVoice[],
  speechLanguage: string,
  t?: (key: string) => string,
): BrowserTtsVoiceOption[] {
  const mapped = voices.map((v) => ({
    voiceURI: v.voiceURI,
    name: v.name,
    lang: v.lang,
    localService: v.localService,
    label: formatBrowserTtsVoiceLabel(v, t),
  }));

  const lang = speechLanguage.trim();
  mapped.sort((a, b) => {
    const aMatch = speechLangMatchesVoice(lang, a.lang) ? 0 : 1;
    const bMatch = speechLangMatchesVoice(lang, b.lang) ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    if (a.localService !== b.localService) return a.localService ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return mapped;
}

export function resolveBrowserTtsVoice(voiceUri: string): SpeechSynthesisVoice | null {
  const uri = normalizeTtsVoiceUri(voiceUri);
  if (!uri) return null;
  const voices = listBrowserTtsVoices();
  return voices.find((v) => v.voiceURI === uri) ?? null;
}

/** Wait until Chrome populates voices (may fire `voiceschanged`). */
export function whenBrowserTtsVoicesReady(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener("voiceschanged", onChange);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const onChange = () => finish();
    const timer = window.setTimeout(finish, timeoutMs);
    synth.addEventListener("voiceschanged", onChange);
    synth.getVoices();
  });
}
