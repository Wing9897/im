import type { TFunction } from "i18next";
import {
  fetchAssistantVoiceIo,
  putAssistantVoiceIo,
} from "../api/uiPrefs";
import {
  USER_EVENTS_FILTER_ID,
  toUserEventFormTaskId,
} from "../domain/timeline/userEvents";
import { isElectronDesktop } from "../electron/electronWindow";
import i18n from "../i18n";
import { logWarn } from "../utils/logger";
import { hydrateServerBackedPref } from "../utils/createServerBackedPrefStore";
import { normalizeTtsVoiceUri } from "./browserTtsVoices";
import type { TtsSpeakOptions } from "./TtsPort";
import type { SttProviderId } from "./SttPort";
import type { TtsProviderId } from "./TtsPort";

import { VOICE_SETTINGS_CHANGED_EVENT } from "./voicePersistedKeys";

/** Dispatched on ``window`` after voice settings are saved (sync or async). */
export { VOICE_SETTINGS_CHANGED_EVENT };

/** Space / mic talk gesture: hold-to-talk vs press-to-toggle. */
export type SpacePttMode = "hold" | "toggle";

export interface VoiceSettings {
  sttProvider: SttProviderId;
  ttsProvider: TtsProviderId;
  /** When true, assistant replies are spoken after they arrive. */
  ttsEnabled: boolean;
  /** BCP-47 tag for STT/TTS; defaults to zh-HK to match app UI. */
  speechLanguage: string;
  /** Space (and mic) talk gesture for assistant STT. */
  spacePttMode: SpacePttMode;
  /** Browser TTS voice URI; empty = system default for ``speechLanguage``. */
  ttsVoiceUri: string;
  /**
   * Default ``calendarTaskId`` for assistant chat / pure-voice creates
   * when the composer has no override. ``__user__`` = 用戶或助手.
   */
  defaultCalendarTaskId: string;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  sttProvider: "browser",
  ttsProvider: "browser",
  ttsEnabled: true,
  speechLanguage: "zh-HK",
  spacePttMode: "hold",
  ttsVoiceUri: "",
  defaultCalendarTaskId: USER_EVENTS_FILTER_ID,
};

const SPACE_PTT_MODES: readonly SpacePttMode[] = ["hold", "toggle"];

function isSpacePttMode(value: unknown): value is SpacePttMode {
  return typeof value === "string" && (SPACE_PTT_MODES as readonly string[]).includes(value);
}

function notifyVoiceSettingsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VOICE_SETTINGS_CHANGED_EVENT));
}

const STT_PROVIDERS: readonly SttProviderId[] = ["browser", "whisper", "doubao"];
const TTS_PROVIDERS: readonly TtsProviderId[] = ["browser", "doubao"];

let cachedSettings: VoiceSettings | null = null;
let hydratePromise: Promise<VoiceSettings> | null = null;

function isSttProvider(value: unknown): value is SttProviderId {
  return typeof value === "string" && (STT_PROVIDERS as readonly string[]).includes(value);
}

function isTtsProvider(value: unknown): value is TtsProviderId {
  return typeof value === "string" && (TTS_PROVIDERS as readonly string[]).includes(value);
}

export function normalizeVoiceSettings(
  raw: Partial<VoiceSettings> | Record<string, unknown> | null | undefined,
): VoiceSettings {
  const parsed = (raw ?? {}) as Partial<VoiceSettings>;
  return {
    sttProvider: isSttProvider(parsed.sttProvider)
      ? parsed.sttProvider
      : DEFAULT_VOICE_SETTINGS.sttProvider,
    ttsProvider: isTtsProvider(parsed.ttsProvider)
      ? parsed.ttsProvider
      : DEFAULT_VOICE_SETTINGS.ttsProvider,
    ttsEnabled:
      typeof parsed.ttsEnabled === "boolean"
        ? parsed.ttsEnabled
        : DEFAULT_VOICE_SETTINGS.ttsEnabled,
    speechLanguage:
      typeof parsed.speechLanguage === "string" && parsed.speechLanguage.trim()
        ? parsed.speechLanguage.trim()
        : DEFAULT_VOICE_SETTINGS.speechLanguage,
    spacePttMode: isSpacePttMode(parsed.spacePttMode)
      ? parsed.spacePttMode
      : DEFAULT_VOICE_SETTINGS.spacePttMode,
    ttsVoiceUri: normalizeTtsVoiceUri(parsed.ttsVoiceUri),
    defaultCalendarTaskId: toUserEventFormTaskId(
      typeof parsed.defaultCalendarTaskId === "string"
        ? parsed.defaultCalendarTaskId
        : DEFAULT_VOICE_SETTINGS.defaultCalendarTaskId,
    ),
  };
}

/** Map persisted voice IO settings to TTS speak options. */
export function ttsSpeakOptionsFromVoiceSettings(
  settings: Pick<VoiceSettings, "speechLanguage" | "ttsVoiceUri">,
): TtsSpeakOptions {
  const opts: TtsSpeakOptions = { lang: settings.speechLanguage };
  const uri = normalizeTtsVoiceUri(settings.ttsVoiceUri);
  if (uri) opts.voiceUri = uri;
  return opts;
}

function setCache(settings: VoiceSettings): void {
  cachedSettings = { ...settings };
}

/** Sync read from memory cache (defaults before hydrate). */
export function loadVoiceSettings(): VoiceSettings {
  if (cachedSettings) return { ...cachedSettings };
  return { ...DEFAULT_VOICE_SETTINGS };
}

/** Hydrate from SQLite. Empty server → defaults. */
export async function hydrateVoiceSettings(): Promise<VoiceSettings> {
  if (!hydratePromise) {
    hydratePromise = hydrateServerBackedPref<VoiceSettings>({
      fetchRemote: async () => {
        const response = await fetchAssistantVoiceIo();
        return {
          configured: response.configured,
          data: response.settings ? normalizeVoiceSettings(response.settings) : null,
        };
      },
      normalize: normalizeVoiceSettings,
      defaults: () => ({ ...DEFAULT_VOICE_SETTINGS }),
      setCache,
      logLabel: "voiceSettings",
    }).finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

/** Persist voice IO settings to SQLite-backed store. */
export function saveVoiceSettings(settings: VoiceSettings): void {
  const normalized = normalizeVoiceSettings(settings);
  setCache(normalized);
  notifyVoiceSettingsChanged();
  void putAssistantVoiceIo(normalized)
    .catch((error) => {
      logWarn("[voiceSettings] failed to save", error);
    });
}

/** Async save with success flag (settings page). */
export async function saveVoiceSettingsAsync(settings: VoiceSettings): Promise<boolean> {
  const normalized = normalizeVoiceSettings(settings);
  try {
    const saved = await putAssistantVoiceIo(normalized);
    setCache(normalizeVoiceSettings(saved.settings ?? normalized));
    notifyVoiceSettingsChanged();
    return true;
  } catch (error) {
    logWarn("[voiceSettings] failed to save", error);
    return false;
  }
}

export function resetVoiceSettingsCacheForTests(): void {
  cachedSettings = null;
  hydratePromise = null;
}

type Translate = TFunction | typeof i18n.t;

export function getSttProviderOptions(
  t: Translate = i18n.t.bind(i18n),
): ReadonlyArray<{ id: SttProviderId; label: string; available: boolean }> {
  // Electron shell cannot use browser cloud STT; keep the option visible but disabled.
  // Unimplemented providers (whisper / doubao) stay in the type union but are omitted
  // from settings options so users never see unfinished choices.
  const browserAvailable = !isElectronDesktop();
  return [
    {
      id: "browser",
      label: String(t("settings:voice.sttOptions.browser")),
      available: browserAvailable,
    },
  ];
}

export function getTtsProviderOptions(
  t: Translate = i18n.t.bind(i18n),
): ReadonlyArray<{ id: TtsProviderId; label: string; available: boolean }> {
  // Unimplemented providers (doubao) stay in the type union but are omitted from UI.
  return [
    { id: "browser", label: String(t("settings:voice.ttsOptions.browser")), available: true },
  ];
}

export function getSpeechLanguageOptions(
  t: Translate = i18n.t.bind(i18n),
): ReadonlyArray<{ id: string; label: string }> {
  return [
    { id: "zh-HK", label: String(t("settings:voice.languageOptions.zhHK")) },
    { id: "zh-TW", label: String(t("settings:voice.languageOptions.zhTW")) },
    { id: "zh-CN", label: String(t("settings:voice.languageOptions.zhCN")) },
    { id: "en-US", label: String(t("settings:voice.languageOptions.enUS")) },
  ];
}
