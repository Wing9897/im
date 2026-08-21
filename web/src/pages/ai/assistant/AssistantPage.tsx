import { useEffect, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import { Eraser, MessageSquare, Volume2, VolumeX } from "lucide-react";
import { EmptyStateGlyph } from "../../../components/common/EmptyStateGlyph";
import { useTranslation } from "react-i18next";
import { Button, SurfaceCard, captionClass, pageTitleClass, AlertBanner } from "../../../components/ui";
import { EmptyState } from "../../../components/common/EmptyState";
import { AssistantComposerShell } from "../../../components/assistant/AssistantComposerShell";
import { useErrorToast } from "../../../hooks/useErrorToast";
import { useAssistantSpacePtt } from "../../../hooks/useAssistantSpacePtt";
import { useStickToBottom } from "../../../hooks/useStickToBottom";
import { useAssistantChat } from "../../../hooks/useAssistantChat";
import { useCollectorStatus } from "../../../context/CollectorStatusContext";
import { AssistantMarkdown } from "../../../components/assistant/AssistantMarkdown";
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
import { listLlmGlobalSlots, listLlmProfiles } from "../../../api/llmProfiles";
import { isLlmProfileComplete } from "../../../domain/settings/llmProfileCompleteness";

/**
 * Built-in assistant: text chat + optional browser PTT / TTS.
 * PTT release sends STT text only (empty recognition does not send the draft).
 * Space talk (when draft is unfocused) follows voice settings — same as quick dialog.
 * LLM binding is global-slot only (AI Provider settings) — no per-session profile UI.
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
    worksetId,
    setWorksetId,
    sendDraft,
    startListening,
    stopListening,
    stopSpeaking,
    clearChat,
  } = useAssistantChat();
  useErrorToast(error);
  const { aiEngineStatus, requestAiStatusRefresh } = useCollectorStatus();
  const aiUnavailable = aiEngineStatus === "unavailable";
  const [assistantSlotReady, setAssistantSlotReady] = useState<boolean | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    Promise.all([listLlmProfiles(), listLlmGlobalSlots()])
      .then(([profiles, slots]) => {
        if (cancelled) return;
        const binding = slots.find((s) => s.slot === "assistant");
        const profileId = (binding?.profileId ?? "").trim();
        if (!profileId) {
          setAssistantSlotReady(false);
          return;
        }
        const profile = profiles.find((p) => p.id === profileId);
        setAssistantSlotReady(Boolean(profile && isLlmProfileComplete(profile)));
      })
      .catch(() => {
        if (!cancelled) setAssistantSlotReady(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        material="panel"
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
            <span>
              {t("common:topBar.aiUnavailableTitle")}{" "}
              <Link
                to="/ai/provider"
                className="underline underline-offset-2"
                data-testid="assistant-ai-settings-link"
              >
                {t("common:topBar.openAiSettings")}
              </Link>
            </span>
          </AlertBanner>
        ) : null}

        {assistantSlotReady === false ? (
          <AlertBanner
            variant="warning"
            className="mx-md mt-sm text-caption"
            data-testid="assistant-slot-unbound"
          >
            <span>
              {t("slotUnbound.message")}{" "}
              <Link
                to="/ai/provider"
                className="underline underline-offset-2"
                data-testid="assistant-slot-settings-link"
              >
                {t("slotUnbound.link")}
              </Link>
            </span>
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
              illustration={<EmptyStateGlyph icon={MessageSquare} />}
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
                    <AssistantMarkdown text={msg.content} />
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

        <AssistantComposerShell
          variant="page"
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
          sendDisabled={aiUnavailable}
          leadingActions={
            ttsEnabled && ttsAvailable ? (
              <span className={`${captionClass} inline-flex items-center gap-1 text-text-muted`}>
                <Volume2 className="size-3.5" aria-hidden />
                {t("ttsOnLabel")}
              </span>
            ) : null
          }
        />
      </SurfaceCard>
    </div>
  );
}
