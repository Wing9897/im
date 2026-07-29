import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import {
  USER_EVENTS_FILTER_ID,
  toUserEventFormTaskId,
} from "../../domain/timeline/userEvents";
import { isElectronDesktop } from "../../electron/electronWindow";
import {
  createSpeechPorts,
  loadVoiceSettings,
  ttsSpeakOptionsFromVoiceSettings,
  VOICE_SETTINGS_CHANGED_EVENT,
  type SpacePttMode,
  type SttPort,
  type TtsPort,
} from "../../speech";

interface UseAssistantChatVoiceOptions {
  /** Live STT text (partial + final) destined for the composer draft. */
  onTranscript: (text: string) => void;
  onError: (message: string | null) => void;
}

export interface AssistantChatVoice {
  listening: boolean;
  speaking: boolean;
  sttAvailable: boolean;
  ttsAvailable: boolean;
  ttsEnabled: boolean;
  spacePttMode: SpacePttMode;
  /** Default owning task for assistant-created calendar entries. */
  calendarTaskId: string;
  setCalendarTaskId: (taskId: string) => void;
  calendarTaskIdRef: MutableRefObject<string>;
  /** Last finalized STT text; cleared when a send starts. */
  heardTextRef: MutableRefObject<string>;
  /**
   * True after a non-empty partial/final in the current listen session.
   * Cleared on ``startListening``; used so release-to-send may fall back to draft
   * without sending typed-only leftovers.
   */
  hadSttTranscriptRef: MutableRefObject<boolean>;
  startListening: () => Promise<void>;
  /** Stop STT only. Send-after-stop is composed in useAssistantChatHost. */
  stopSttOnly: () => Promise<void>;
  stopSpeaking: () => void;
  speakIfEnabled: (text: string) => Promise<void>;
  /** Re-create STT/TTS ports after a provider change. */
  refreshPorts: () => ReturnType<typeof loadVoiceSettings>;
}

/**
 * Owns speech I/O for the assistant chat: STT/TTS port lifecycle, availability,
 * voice-settings sync, and the listening / speaking flags.
 *
 * Single owner of the listen lifecycle (start / stop / epoch). Release-to-send
 * policy lives in ``useAssistantChatHost.stopListening``; PTT gestures live in
 * ``useAssistantMicPtt`` / ``useAssistantSpacePtt``.
 */
export function useAssistantChatVoice({
  onTranscript,
  onError,
}: UseAssistantChatVoiceOptions): AssistantChatVoice {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(() => loadVoiceSettings().ttsEnabled);
  const [spacePttMode, setSpacePttMode] = useState(() => loadVoiceSettings().spacePttMode);
  const [calendarTaskId, setCalendarTaskIdState] = useState(() =>
    toUserEventFormTaskId(loadVoiceSettings().defaultCalendarTaskId),
  );

  const sttRef = useRef<SttPort | null>(null);
  const ttsRef = useRef<TtsPort | null>(null);
  const listeningRef = useRef(false);
  /** Bumped on every stop (and each start) so an in-flight ``stt.start`` cannot stick after release. */
  const listenEpochRef = useRef(0);
  const heardTextRef = useRef("");
  const hadSttTranscriptRef = useRef(false);
  const calendarTaskIdRef = useRef(calendarTaskId);
  calendarTaskIdRef.current = calendarTaskId;

  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);
  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  const setCalendarTaskId = useCallback((taskId: string) => {
    setCalendarTaskIdState(toUserEventFormTaskId(taskId || USER_EVENTS_FILTER_ID));
  }, []);

  const refreshPorts = useCallback(() => {
    const settings = loadVoiceSettings();
    setTtsEnabled(settings.ttsEnabled);
    setSpacePttMode(settings.spacePttMode);
    const ports = createSpeechPorts({
      sttProvider: settings.sttProvider,
      ttsProvider: settings.ttsProvider,
    });
    sttRef.current?.stop().catch(() => undefined);
    ttsRef.current?.cancel();
    sttRef.current = ports.stt;
    ttsRef.current = ports.tts;
    setSttAvailable(ports.stt.isAvailable());
    setTtsAvailable(ports.tts.isAvailable());
    return settings;
  }, []);

  useEffect(() => {
    const onVoiceSettings = () => {
      const settings = loadVoiceSettings();
      setTtsEnabled(settings.ttsEnabled);
      setSpacePttMode(settings.spacePttMode);
      setCalendarTaskIdState(toUserEventFormTaskId(settings.defaultCalendarTaskId));
    };
    window.addEventListener(VOICE_SETTINGS_CHANGED_EVENT, onVoiceSettings);
    return () => window.removeEventListener(VOICE_SETTINGS_CHANGED_EVENT, onVoiceSettings);
  }, []);

  useEffect(() => {
    refreshPorts();
    const stt = sttRef.current;
    if (!stt) return;

    const unsubscribe = stt.subscribe((ev) => {
      if (ev.type === "partial" || ev.type === "final") {
        heardTextRef.current = ev.text;
        if (ev.text.trim()) {
          hadSttTranscriptRef.current = true;
        }
        onTranscriptRef.current(ev.text);
      } else if (ev.type === "error") {
        onErrorRef.current(ev.message);
        setListening(false);
        listeningRef.current = false;
      }
    });

    return () => {
      unsubscribe();
      void stt.stop();
      ttsRef.current?.cancel();
    };
  }, [refreshPorts]);

  const stopSpeaking = useCallback(() => {
    ttsRef.current?.cancel();
    setSpeaking(false);
  }, []);

  const speakIfEnabled = useCallback(async (text: string) => {
    const settings = loadVoiceSettings();
    setTtsEnabled(settings.ttsEnabled);
    const tts = ttsRef.current;
    if (!settings.ttsEnabled || !tts?.isAvailable() || !text.trim()) {
      return;
    }
    setSpeaking(true);
    try {
      await tts.speak(text, ttsSpeakOptionsFromVoiceSettings(settings));
    } catch {
      /* TTS failure must not block chat */
    } finally {
      setSpeaking(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    // Desktop shell: never start Web Speech (coexist with browser-tab voice).
    if (isElectronDesktop()) return;
    const settings = loadVoiceSettings();
    const stt = sttRef.current;
    if (!stt?.isAvailable() || listeningRef.current) return;
    onErrorRef.current(null);
    stopSpeaking();
    heardTextRef.current = "";
    hadSttTranscriptRef.current = false;
    // Drop leftover composer/caption text from the previous utterance so hold
    // does not briefly show “last time’s” transcript as live STT.
    onTranscriptRef.current("");
    const epoch = ++listenEpochRef.current;
    listeningRef.current = true;
    setListening(true);
    try {
      await stt.start({ language: settings.speechLanguage });
    } catch {
      if (listenEpochRef.current === epoch) {
        listeningRef.current = false;
        setListening(false);
      }
      return;
    }
    // Released (or superseded) while ``stt.start`` was awaiting — ensure engine is down.
    if (listenEpochRef.current !== epoch) {
      await stt.stop().catch(() => undefined);
      return;
    }
  }, [stopSpeaking]);

  const stopSttOnly = useCallback(async () => {
    // Invalidate in-flight start even if listeningRef was not set yet / already cleared.
    listenEpochRef.current += 1;
    if (!listeningRef.current) {
      await sttRef.current?.stop().catch(() => undefined);
      return;
    }
    listeningRef.current = false;
    setListening(false);
    await sttRef.current?.stop();
  }, []);

  return {
    listening,
    speaking,
    sttAvailable,
    ttsAvailable,
    ttsEnabled,
    spacePttMode,
    calendarTaskId,
    setCalendarTaskId,
    calendarTaskIdRef,
    heardTextRef,
    hadSttTranscriptRef,
    startListening,
    stopSttOnly,
    stopSpeaking,
    speakIfEnabled,
    refreshPorts,
  };
}
