import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Button, TextArea, captionClass } from "./ui";
import { useErrorToast } from "../hooks/useErrorToast";
import { useAssistantQuick } from "../hooks/useAssistantQuick";
import { useAssistantSpacePtt } from "../hooks/useAssistantSpacePtt";
import { useAssistantChat } from "../hooks/useAssistantChat";
import { isTaskEditorPath } from "../domain/tasks/taskEditorDraftBridge";
import { AssistantDirectBubbles } from "./assistant/AssistantDirectBubbles";
import { AssistantMicButton } from "./assistant/AssistantMicButton";
import { AssistantToolSummary } from "./assistant/AssistantToolSteps";
import { CalendarTaskTargetSelect } from "./assistant/CalendarTaskTargetSelect";
import { staffIdForAgentTool } from "./assistant/assistantToolStaff";

/**
 * Always-on voice host — Space PTT + subtitle flashes.
 * Text composer includes the same hold/toggle mic as `/assistant`
 * (mic works while the draft is focused; Space does not).
 * History replay is owned by AssistantDirectBubbles (frozen until first listen/send).
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
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Voice PTT turn stays visible through send after mic release (composer may be closed). */
  const [voiceTurn, setVoiceTurn] = useState(false);
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
    calendarTaskId,
    setCalendarTaskId,
    sendDraft,
    startListening,
    stopListening,
    stopSpeaking,
    clearChat,
  } = useAssistantChat();
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
    if (listening || holdArmed) setVoiceTurn(true);
  }, [holdArmed, listening]);

  useEffect(() => {
    if (!sending && !listening && !holdArmed) setVoiceTurn(false);
  }, [holdArmed, listening, sending]);

  useEffect(() => {
    if (!composerOpen) setHistoryOpen(false);
    // Do not auto-focus the draft: keep Space PTT live until the user clicks to type.
  }, [composerOpen]);

  useEffect(() => {
    if (!historyOpen) return;
    const el = historyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [historyOpen, messages.length, sending]);

  const composer: ReactNode = (
    <div className="im-assistant-direct__composer" data-testid="assistant-caption-composer">
      {historyOpen ? (
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
                  <p className="im-assistant-direct__composer-history-text">{message.content}</p>
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
      ) : null}
      <label className="sr-only" htmlFor="assistant-caption-draft">
        {t("quick.draftLabel")}
      </label>
      <div className="im-assistant-direct__composer-target">
        <label
          className={`${captionClass} im-assistant-direct__composer-target-label`}
          htmlFor="assistant-caption-calendar-task"
        >
          {t("targetTask.label")}
        </label>
        <CalendarTaskTargetSelect
          id="assistant-caption-calendar-task"
          value={calendarTaskId}
          onChange={setCalendarTaskId}
          disabled={sending}
          className="im-assistant-direct__composer-target-select"
          data-testid="assistant-caption-calendar-task"
        />
      </div>
      <TextArea
        id="assistant-caption-draft"
        data-testid="assistant-caption-draft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={
          listening ? t("quick.placeholderListening") : t("quick.placeholderIdle")
        }
        rows={2}
        className="im-assistant-direct__composer-input"
        disabled={sending}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            closeComposer();
            return;
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendDraft();
          }
        }}
      />
      <div className="im-assistant-direct__composer-actions">
        {sttAvailable ? (
          <AssistantMicButton
            spacePttMode={spacePttMode}
            listening={listening}
            sending={sending}
            startListening={startListening}
            stopListening={stopListening}
            size="sm"
            className="im-assistant-direct__composer-mic"
            testId="assistant-caption-ptt"
          />
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          data-testid="assistant-caption-history-toggle"
          aria-pressed={historyOpen}
          onClick={() => setHistoryOpen((open) => !open)}
        >
          {historyOpen ? t("quick.hideHistory") : t("quick.showHistory")}
        </Button>
        <Button
          variant="primary"
          size="sm"
          data-testid="assistant-caption-send"
          onClick={() => void sendDraft()}
          disabled={sending || !draft.trim()}
        >
          {sending ? t("quick.sendingBtn") : t("quick.send")}
        </Button>
      </div>
    </div>
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
      taskAdvisorPresence={showTaskAdvisorPresence}
    />
  );
}
