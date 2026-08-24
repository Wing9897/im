import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Eraser } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Button } from "./ui";
import { useErrorToast } from "../hooks/useErrorToast";
import { useAssistantQuick } from "../hooks/useAssistantQuick";
import { useAssistantSpacePtt } from "../hooks/useAssistantSpacePtt";
import { useAssistantChat } from "../hooks/useAssistantChat";
import { isTaskEditorPath } from "../domain/tasks/taskEditorDraftBridge";
import { AssistantDirectBubbles } from "./assistant/AssistantDirectBubbles";
import { AssistantMarkdown } from "./assistant/AssistantMarkdown";
import { AssistantComposerShell } from "./assistant/AssistantComposerShell";
import { AssistantToolSummary } from "./assistant/AssistantToolSteps";
import { staffIdForAgentTool } from "./assistant/assistantToolStaff";
import {
  latestAssistantId,
  shouldKeepVoiceTurn,
} from "./assistant/assistantVoiceTurn";

/**
 * Always-on voice host — Space PTT + subtitle flashes.
 * Text composer includes the same hold/toggle mic as `/assistant`
 * (mic works while the draft is focused; Space does not).
 * Flash vs persist: current-turn overlay (AGENT_HIDE_MS) or a pinned composer
 * transcript. History replay in flashes is frozen until first listen/send.
 */
export function AssistantQuickDialog() {
  const { t } = useTranslation(["assistant", "common"]);
  const { pathname } = useLocation();
  const taskAdvisorPresence = isTaskEditorPath(pathname);
  const {
    captionActive,
    composerOpen,
    voiceLive,
    closeComposer,
    setCaptionListening,
    registerChatActions,
  } = useAssistantQuick();
  const [holdArmed, setHoldArmed] = useState(false);
  const [showReadyHint, setShowReadyHint] = useState(false);
  /** Persist: keep composer transcript. Flash: current turn then auto-hide. */
  const [persistTranscript, setPersistTranscript] = useState(false);
  /** Voice PTT turn stays visible through send after mic release (composer may be closed). */
  const [voiceTurn, setVoiceTurn] = useState(false);
  const voiceSendStartedRef = useRef(false);
  const voiceAssistantIdAtArmRef = useRef<string | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const {
    messages,
    draft,
    setDraft,
    sending,
    liveToolSteps,
    listening,
    speaking,
    error,
    sttAvailable,
    spacePttMode,
    worksetId,
    setWorksetId,
    sendDraft,
    startListening,
    stopListening,
    stopSpeaking,
    clearChat,
  } = useAssistantChat();
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useErrorToast(error);

  // Space PTT only when STT really works — never arm keys on desktop browser STT.
  useAssistantSpacePtt({
    enabled: voiceLive && sttAvailable,
    sttAvailable,
    sending,
    listening,
    startListening,
    stopListening,
    mode: spacePttMode,
    onHoldChange: setHoldArmed,
  });

  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;

  useEffect(() => {
    registerChatActions({
      speaking,
      canClear: !sending && (messages.length > 0 || Boolean(draft.trim())),
      sttAvailable,
      clearChat,
      stopSpeaking,
    });
    return () => registerChatActions(null);
  }, [
    clearChat,
    draft,
    messages.length,
    registerChatActions,
    sending,
    speaking,
    sttAvailable,
    stopSpeaking,
  ]);

  useLayoutEffect(() => {
    if (!captionActive) {
      setHoldArmed(false);
      setShowReadyHint(false);
      setCaptionListening(false);
      setVoiceTurn(false);
      voiceSendStartedRef.current = false;
      voiceAssistantIdAtArmRef.current = null;
      void stopListeningRef.current();
      return;
    }
    // Honest UX: never flash “hold Space” when STT cannot start.
    setShowReadyHint(sttAvailable);
  }, [captionActive, setCaptionListening, sttAvailable]);

  useEffect(() => {
    if (voiceLive) return;
    // Focusing an editable pauses Space PTT only (handled by Space focusin /
    // enabled=false). Do NOT stopListening here — that would kill mic PTT
    // while the draft stays focused (mic is intentional for speak-while-typing).
    setHoldArmed(false);
  }, [voiceLive]);

  useEffect(() => {
    // Mic can listen while the draft is focused; Space arming only when voiceLive.
    setCaptionListening(listening || (voiceLive && holdArmed));
  }, [holdArmed, listening, setCaptionListening, voiceLive]);

  useEffect(() => {
    if (listening || (voiceLive && holdArmed)) setShowReadyHint(false);
  }, [holdArmed, listening, voiceLive]);

  useEffect(() => {
    if (!(listening || holdArmed)) return;
    setVoiceTurn((prev) => {
      if (!prev) {
        voiceAssistantIdAtArmRef.current = latestAssistantId(messagesRef.current);
        voiceSendStartedRef.current = false;
      }
      return true;
    });
  }, [holdArmed, listening]);

  useEffect(() => {
    if (sending && voiceTurn) {
      voiceSendStartedRef.current = true;
    }
  }, [sending, voiceTurn]);

  useEffect(() => {
    if (!voiceTurn) return;
    const keep = shouldKeepVoiceTurn({
      listening,
      holdArmed,
      sending,
      sendStartedThisTurn: voiceSendStartedRef.current,
      assistantIdWhenArmed: voiceAssistantIdAtArmRef.current,
      latestAssistantId: latestAssistantId(messages),
    });
    if (!keep) {
      setVoiceTurn(false);
      voiceSendStartedRef.current = false;
    }
  }, [holdArmed, listening, messages, sending, voiceTurn]);

  useEffect(() => {
    if (!persistTranscript) return;
    const el = historyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [persistTranscript, messages.length, sending]);

  const composer: ReactNode = (
    <AssistantComposerShell
      variant="overlay"
      draft={draft}
      onDraftChange={setDraft}
      sending={sending}
      listening={listening}
      worksetId={worksetId}
      onWorksetIdChange={setWorksetId}
      onSend={sendDraft}
      sttAvailable={sttAvailable}
      spacePttMode={spacePttMode}
      startListening={startListening}
      stopListening={stopListening}
      onDraftKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeComposer();
        }
      }}
      header={
        persistTranscript ? (
          <div
            ref={historyRef}
            className="im-assistant-direct__composer-history im-auto-scrollbar"
            data-testid="assistant-caption-history"
            role="log"
            aria-label={t("quick.historyPanelAria")}
          >
            {messages.length === 0 ? (
              <p className="im-assistant-direct__composer-history-empty">{t("quick.historyEmpty")}</p>
            ) : (
              messages.map((message) => {
                const advisorStep =
                  taskAdvisorPresence &&
                  message.role === "assistant" &&
                  message.toolCalls?.some((call) => staffIdForAgentTool(call.name) === "taskEditor");
                return (
                  <div
                    key={message.id}
                    className="im-assistant-direct__composer-history-item"
                    data-role={message.role}
                    data-testid="assistant-caption-history-item"
                  >
                    <span className="im-assistant-direct__composer-history-role">
                      {message.role === "user"
                        ? t("common:editor.you")
                        : t("common:aiStaff.assistant")}
                      {advisorStep ? (
                        <span
                          className="im-assistant-direct__composer-history-advisor"
                          data-testid="assistant-caption-history-advisor"
                        >
                          {" · "}
                          {t("common:aiStaff.taskEditor")}
                        </span>
                      ) : null}
                    </span>
                    {message.role === "user" ? (
                      <p className="im-assistant-direct__composer-history-text">{message.content}</p>
                    ) : (
                      <div className="im-assistant-direct__composer-history-text">
                        <AssistantMarkdown text={message.content} />
                      </div>
                    )}
                    {message.role === "assistant" &&
                    message.toolCalls &&
                    message.toolCalls.length > 0 ? (
                      <AssistantToolSummary
                        toolCalls={message.toolCalls}
                        attributeTaskAdvisor={taskAdvisorPresence}
                      />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        ) : null
      }
      afterDraft={
        <Button
          variant="ghost"
          size="icon"
          className="im-assistant-direct__composer-clear"
          data-testid="assistant-caption-clear"
          aria-label={t("quick.clearChat")}
          title={t("quick.clearChat")}
          disabled={sending || (messages.length === 0 && !draft.trim())}
          onClick={clearChat}
        >
          <Eraser size={14} strokeWidth={2.2} aria-hidden="true" />
        </Button>
      }
      extraActions={
        <Button
          variant="secondary"
          size="sm"
          data-testid="assistant-caption-history-toggle"
          data-mode={persistTranscript ? "persist" : "flash"}
          aria-pressed={persistTranscript}
          aria-label={
            persistTranscript ? t("quick.persistMode") : t("quick.flashMode")
          }
          title={persistTranscript ? t("quick.persistMode") : t("quick.flashMode")}
          onClick={() => setPersistTranscript((persist) => !persist)}
        >
          {persistTranscript ? t("quick.persistMode") : t("quick.flashMode")}
        </Button>
      }
    />
  );

  if (!captionActive) return null;

  // Closing the text dialog must hide dual-presence + text-send "thinking" residue.
  // Voice PTT turns still show mic / send flashes without the composer.
  const showAgentSending = sending && (composerOpen || voiceTurn);
  const showTaskAdvisorPresence = taskAdvisorPresence && composerOpen;

  return (
    <AssistantDirectBubbles
      active={composerOpen}
      messages={messages}
      draft={draft}
      sending={showAgentSending}
      listening={listening}
      holdArmed={voiceLive && holdArmed}
      liveToolSteps={showAgentSending ? liveToolSteps : []}
      showReadyHint={voiceLive && !composerOpen && sttAvailable && showReadyHint}
      onReadyHintConsumed={() => setShowReadyHint(false)}
      composer={composerOpen ? composer : undefined}
      persistTranscript={persistTranscript}
      taskAdvisorPresence={showTaskAdvisorPresence}
    />
  );
}
