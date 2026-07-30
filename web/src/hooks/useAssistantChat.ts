import {
  useCallback,
  useRef,
  createContext,
  useContext,
  createElement,
  type ReactNode,
} from "react";
import { ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY } from "../domain/assistant/assistantPersistedKeys";
import { resolveVoiceReleaseText } from "./assistantPtt/voiceReleaseSend";
import { useAssistantChatSession } from "./assistantChat/useAssistantChatSession";
import { useAssistantChatStream } from "./assistantChat/useAssistantChatStream";
import { useAssistantChatVoice } from "./assistantChat/useAssistantChatVoice";

export { ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY };

/**
 * Composes the assistant chat host from its three concerns: transcript/session
 * state, speech I/O, and the streaming turn.
 *
 * Voice ownership:
 * - ``useAssistantChatVoice`` — listen lifecycle (start/stop/epoch) + STT/TTS ports
 * - ``stopListening`` here — release-to-send policy (STT text; draft only if STT spoke)
 * - ``useAssistantMicPtt`` / ``useAssistantSpacePtt`` — hold vs toggle input gestures
 */
export function useAssistantChatHost() {
  // Shared so an external session update cannot clobber an in-flight turn.
  const sendingRef = useRef(false);

  const session = useAssistantChatSession(sendingRef);
  const { setDraft, setError } = session;

  const voice = useAssistantChatVoice({
    onTranscript: setDraft,
    onError: setError,
  });

  const { sending, liveToolSteps, sendContent } = useAssistantChatStream({
    session,
    voice,
    sendingRef,
  });

  const { draftRef } = session;
  const { heardTextRef, hadSttTranscriptRef } = voice;
  /** Prevents overlapping stop+send (e.g. button + window pointerup) from double-sending. */
  const voiceReleaseSendLockRef = useRef(false);

  const sendDraft = useCallback(async () => {
    await sendContent(draftRef.current);
  }, [draftRef, sendContent]);

  /**
   * Stop STT; when ``send`` is true, submit STT text (heard ref, then draft if
   * this session actually recognized speech). Snapshot before ``stopSttOnly`` so
   * teardown races cannot drop the transcript into a stuck composer draft.
   */
  const stopListening = useCallback(
    async (options?: { send?: boolean }) => {
      const shouldSend = Boolean(options?.send);
      if (shouldSend && voiceReleaseSendLockRef.current) {
        await voice.stopSttOnly();
        return;
      }
      if (shouldSend) {
        voiceReleaseSendLockRef.current = true;
      }
      const heardBeforeStop = heardTextRef.current;
      const draftBeforeStop = draftRef.current;
      const hadSttTranscript = hadSttTranscriptRef.current;
      try {
        await voice.stopSttOnly();
        if (!shouldSend) return;
        const content = resolveVoiceReleaseText({
          heardAfterStop: heardTextRef.current,
          heardBeforeStop,
          draftBeforeStop,
          hadSttTranscript,
        });
        heardTextRef.current = "";
        hadSttTranscriptRef.current = false;
        if (!content) return;
        await sendContent(content);
      } finally {
        if (shouldSend) {
          voiceReleaseSendLockRef.current = false;
        }
      }
    },
    [draftRef, hadSttTranscriptRef, heardTextRef, sendContent, voice],
  );

  /** Start a fresh local session (keeps prior sessions in history). */
  const clearChat = useCallback(() => {
    voice.stopSpeaking();
    void voice.stopSttOnly();
    session.startNewSession();
  }, [session, voice]);

  return {
    activeSessionId: session.activeSessionId,
    messages: session.messages,
    draft: session.draft,
    setDraft: session.setDraft,
    sending,
    liveToolSteps,
    listening: voice.listening,
    speaking: voice.speaking,
    error: session.error,
    sttAvailable: voice.sttAvailable,
    ttsAvailable: voice.ttsAvailable,
    ttsEnabled: voice.ttsEnabled,
    spacePttMode: voice.spacePttMode,
    worksetId: voice.worksetId,
    setWorksetId: voice.setWorksetId,
    sendDraft,
    startListening: voice.startListening,
    stopListening,
    stopSpeaking: voice.stopSpeaking,
    clearChat,
    refreshPorts: voice.refreshPorts,
    /** @internal test / diagnostics — live STT buffer */
    heardTextRef: voice.heardTextRef,
  };
}

export type AssistantChatContextValue = ReturnType<typeof useAssistantChatHost>;

const AssistantChatContext = createContext<AssistantChatContextValue | null>(null);

/** Single app-shell chat host — mounts one stream/voice/session state tree. */
export function AssistantChatProvider({ children }: { children: ReactNode }) {
  const value = useAssistantChatHost();
  return createElement(AssistantChatContext.Provider, { value }, children);
}

export function useAssistantChat(): AssistantChatContextValue {
  const ctx = useContext(AssistantChatContext);
  if (!ctx) {
    throw new Error("useAssistantChat must be used within AssistantChatProvider");
  }
  return ctx;
}
