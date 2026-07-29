import { useEffect, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Eraser, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, SurfaceCard, TextArea, captionClass, pageTitleClass, AlertBanner } from "../../../components/ui";
import { EmptyState } from "../../../components/common/EmptyState";
import { CalendarTaskTargetSelect } from "../../../components/assistant/CalendarTaskTargetSelect";
import { AssistantMicButton } from "../../../components/assistant/AssistantMicButton";
import { useErrorToast } from "../../../hooks/useErrorToast";
import { useAssistantSpacePtt } from "../../../hooks/useAssistantSpacePtt";
import { useStickToBottom } from "../../../hooks/useStickToBottom";
import { useAssistantChat } from "../../../hooks/useAssistantChat";
import { useCollectorStatus } from "../../../context/CollectorStatusContext";
import {
  AssistantLiveToolSteps,
  AssistantToolSummary,
} from "../../../components/assistant/AssistantToolSteps";
import { AiStaffAvatar } from "../../../components/aiStaff/AiStaffAvatar";
import { AiStaffChatRow } from "../../../components/aiStaff/AiStaffChatRow";
import {
  assistantChatBubbleClass,
  userChatBubbleClass,
} from "../../../components/chat/chatBubbleClasses";
import {
  resolveAssistantDisplayName,
  useAssistantIdentity,
} from "../../../domain/aiStaff/assistantIdentity";
import { isEditableTarget } from "../../../utils/isEditableTarget";
import { isAssistantDirectModeSupported } from "../../../domain/assistant/directModeSupport";

/**
 * Built-in assistant: text chat + optional browser PTT / TTS.
 * PTT release sends STT text only (empty recognition does not send the draft).
 * Space talk (when draft is unfocused) follows voice settings — same as quick dialog.
 */
export function AssistantPage() {
  const { t } = useTranslation(["assistant", "common"]);
  const { identity } = useAssistantIdentity();
  const displayName = resolveAssistantDisplayName(
    identity,
    t("common:aiStaff.assistant"),
  );
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
    ttsAvailable,
    ttsEnabled,
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
  const { aiEngineStatus, requestAiStatusRefresh } = useCollectorStatus();
  const aiUnavailable = aiEngineStatus === "unavailable";

  useEffect(() => {
    if (aiUnavailable) requestAiStatusRefresh(true);
  }, [aiUnavailable, requestAiStatusRefresh]);

  useEffect(() => {
    if (!error) return;
    if (
      error.includes("AI 引擎無法連線") ||
      error.includes("AI engine unreachable") ||
      error.includes("localhost:11434") ||
      error.includes("Cannot connect")
    ) {
      requestAiStatusRefresh(true);
    }
  }, [error, requestAiStatusRefresh]);

  useAssistantSpacePtt({
    sttAvailable,
    sending,
    listening,
    startListening,
    stopListening,
    mode: spacePttMode,
  });

  /** Clicking messages/header/actions blurs the draft so Space PTT can arm. */
  const blurDraftIfOutsideEditable = (event: ReactPointerEvent<HTMLElement>) => {
    if (isEditableTarget(event.target)) return;
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement && active.dataset.testid === "assistant-draft") {
      active.blur();
    }
  };

  const messagesRef = useStickToBottom([
    messages.length,
    sending,
    liveToolSteps.length,
    messages[messages.length - 1]?.content,
  ]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-md"
      data-testid="assistant-page"
      onPointerDown={blurDraftIfOutsideEditable}
    >
      <SurfaceCard
        material="solid"
        density="field"
        className="flex min-h-[280px] flex-1 flex-col overflow-hidden"
      >
        <header
          className="flex shrink-0 items-center gap-sm border-b border-surface-border px-md py-sm"
          data-testid="assistant-card-header"
          aria-label={t("header.aria")}
        >
          <AiStaffAvatar
            staffId="assistant"
            size="sm"
            label={displayName}
            src={identity.avatarDataUrl}
          />
          <div className={`min-w-0 flex-1 truncate ${pageTitleClass}`}>
            {displayName}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {speaking ? (
              <Button
                variant="secondary"
                size="icon"
                onClick={stopSpeaking}
                aria-label={t("toolbar.stopSpeaking")}
                title={t("toolbar.stopSpeaking")}
              >
                <VolumeX className="size-3.5" aria-hidden />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              disabled={sending || (messages.length === 0 && !draft)}
              aria-label={t("toolbar.clearChat")}
              title={t("toolbar.clearChat")}
            >
              <Eraser size={14} strokeWidth={2.2} aria-hidden="true" />
            </Button>
          </div>
        </header>

        {aiUnavailable ? (
          <AlertBanner
            variant="warning"
            className="mx-md mt-sm text-caption"
            data-testid="assistant-ai-unavailable"
          >
            {t("common:topBar.aiUnavailableTitle")}
          </AlertBanner>
        ) : null}

        <div
          ref={messagesRef as RefObject<HTMLDivElement>}
          className="flex min-h-0 flex-1 flex-col gap-md overflow-y-auto px-md py-md"
          data-testid="assistant-messages"
          role="log"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <EmptyState
              compact
              title={t("empty.title")}
              hint={
                sttAvailable
                  ? undefined
                  : !isAssistantDirectModeSupported()
                    ? t("common:speech.sttDesktopUnavailable")
                    : t("stt.unavailable")
              }
            />
          ) : (
            messages.map((msg) =>
              msg.role === "user" ? (
                <div
                  key={msg.id}
                  data-testid={`assistant-msg-${msg.role}`}
                  className={userChatBubbleClass(42)}
                >
                  {msg.content}
                </div>
              ) : (
                <AiStaffChatRow
                  key={msg.id}
                  staffId="assistant"
                  testId={`assistant-msg-${msg.role}`}
                >
                  <div className={assistantChatBubbleClass("full")}>
                    {msg.content}
                    {msg.toolCalls && msg.toolCalls.length > 0 ? (
                      <AssistantToolSummary toolCalls={msg.toolCalls} />
                    ) : null}
                  </div>
                </AiStaffChatRow>
              ),
            )
          )}
          {sending && liveToolSteps.length > 0 ? (
            <AiStaffChatRow staffId="assistant">
              <AssistantLiveToolSteps steps={liveToolSteps} bare />
            </AiStaffChatRow>
          ) : null}
          {sending ? (
            <AiStaffChatRow
              staffId="assistant"
              sendingLabel={t("sending")}
              testId="assistant-sending"
            />
          ) : null}
        </div>

        <div className="border-t border-surface-border px-md py-md">
          <div className="mb-sm flex flex-wrap items-center gap-sm">
            <label
              className={`${captionClass} shrink-0 text-text-muted`}
              htmlFor="assistant-calendar-task"
            >
              {t("targetTask.label")}
            </label>
            <CalendarTaskTargetSelect
              id="assistant-calendar-task"
              value={calendarTaskId}
              onChange={setCalendarTaskId}
              disabled={sending}
              className="min-w-[10rem] max-w-full flex-1 sm:max-w-xs"
              data-testid="assistant-calendar-task"
            />
          </div>
          <label className="sr-only" htmlFor="assistant-draft">
            {t("draft.label")}
          </label>
          <TextArea
            id="assistant-draft"
            data-testid="assistant-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              listening ? t("draft.placeholderListening") : t("draft.placeholderIdle")
            }
            rows={3}
            className="min-h-[88px]"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendDraft();
              }
            }}
          />
          <div className="mt-sm flex flex-wrap items-center justify-between gap-md">
            <div className="flex flex-wrap items-center gap-sm">
              {sttAvailable ? (
                <AssistantMicButton
                  spacePttMode={spacePttMode}
                  listening={listening}
                  sending={sending}
                  startListening={startListening}
                  stopListening={stopListening}
                />
              ) : null}
              {ttsEnabled && ttsAvailable ? (
                <span className={`${captionClass} inline-flex items-center gap-1 text-text-muted`}>
                  <Volume2 className="size-3.5" aria-hidden />
                  {t("ttsOnLabel")}
                </span>
              ) : null}
            </div>
            <Button
              variant="primary"
              size="md"
              data-testid="assistant-send"
              onClick={() => void sendDraft()}
              disabled={sending || aiUnavailable || !draft.trim()}
            >
              {sending ? t("send.sending") : t("send.label")}
            </Button>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
