import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Mic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { assistantChatBubbleClass } from "../chat/chatBubbleClasses";
import { AssistantMarkdown } from "./AssistantMarkdown";
import {
  resolveAssistantDisplayName,
  useAssistantIdentity,
} from "../../domain/aiStaff/assistantIdentity";
import {
  resolveUserDisplayName,
  useUserProfile,
} from "../../domain/user/userProfile";
import {
  AssistantLiveToolSteps,
  AssistantToolSummary,
  type LiveToolStep,
} from "./AssistantToolSteps";
import type { AssistantSessionMessage } from "../../domain/assistant/assistantSessions";
import {
  DirectAssistantAvatar,
  DirectStaffAvatar,
  DirectUserAvatar,
} from "./AssistantDirectAvatars";
import { useAssistantDirectFlashes } from "./useAssistantDirectFlashes";

type AssistantDirectBubblesProps = {
  messages: readonly AssistantSessionMessage[];
  /** Live STT / draft text (partial + final before send clears it). */
  draft?: string;
  sending: boolean;
  listening: boolean;
  /** Space held before STT ``listening`` flips true — show feedback immediately. */
  holdArmed?: boolean;
  liveToolSteps: readonly LiveToolStep[];
  /** Show a short “hold Space” hint when mode just enabled. */
  showReadyHint?: boolean;
  /** Fired once the ready hint is consumed (shown/faded or interrupted by hold/listen). */
  onReadyHintConsumed?: () => void;
  /**
   * When true, keep the surface mounted even with no flashes
   * (needed for the translucent composer).
   */
  active?: boolean;
  /** Optional composer row rendered under the bubble stack. */
  composer?: ReactNode;
  /**
   * Persist mode: keep the composer transcript visible and skip current-turn
   * flash bubbles (they would duplicate the history panel). Flash mode still
   * shows user/reply lanes above the composer, then AGENT_HIDE_MS / USER_HIDE_MS.
   */
  persistTranscript?: boolean;
  /**
   * Task create/edit only: add task-advisor next to the assistant in presence
   * chrome and attribute ``tasks.consult_advisor`` steps to the advisor.
   * Assistant-only presence still shows whenever ``composer`` is open.
   */
  taskAdvisorPresence?: boolean;
};

function rowClass(fading: boolean): string {
  return fading
    ? "im-assistant-direct__row im-assistant-direct__item--fade"
    : "im-assistant-direct__row";
}

/**
 * Caption overlay for direct (voice) mode: renders the current turn's mic,
 * transcript, and reply lanes into a body portal.
 *
 * Flash lifecycle lives in {@link useAssistantDirectFlashes}; this component is
 * presentation only.
 */
export function AssistantDirectBubbles({
  messages,
  draft = "",
  sending,
  listening,
  holdArmed = false,
  liveToolSteps,
  showReadyHint = false,
  onReadyHintConsumed,
  active = false,
  composer,
  persistTranscript = false,
  taskAdvisorPresence = false,
}: AssistantDirectBubblesProps) {
  const { t } = useTranslation(["assistant", "common"]);
  const { identity } = useAssistantIdentity();
  const { profile } = useUserProfile();
  const displayName = resolveAssistantDisplayName(
    identity,
    t("common:aiStaff.assistant"),
  );
  const taskAdvisorName = t("common:aiStaff.taskEditor");
  const userDisplayName = resolveUserDisplayName(profile, t("common:editor.you"));

  const {
    isListening,
    draftText,
    micFlash,
    micFading,
    userFlash,
    agentFlash,
    readyVisible,
    readyFading,
    latestAssistant,
    showFlashes,
  } = useAssistantDirectFlashes({
    messages,
    draft,
    sending,
    listening,
    holdArmed,
    showReadyHint,
    onReadyHintConsumed,
  });

  const showPortal = active || showFlashes;
  // Text composer chrome (any route) shows assistant presence; task editor adds advisor.
  const showPresence = Boolean(composer) || taskAdvisorPresence;

  if (!showPortal || typeof document === "undefined") return null;

  const showLiveDraft = isListening && Boolean(draftText);
  const agentSending = agentFlash?.key === "sending";
  const agentReply =
    agentFlash && agentFlash.key !== "sending" ? agentFlash : null;
  // Persist + composer: history panel owns the transcript. Flash mode (or
  // voice with composer closed) still shows the current-turn lanes.
  const hideTurnBubbles = persistTranscript && Boolean(composer);
  // Never stack a prior user bar under live STT (double bar of last transcript).
  const showUserFlash = Boolean(userFlash) && !isListening && !hideTurnBubbles;
  const showAgentReply = Boolean(agentReply) && !hideTurnBubbles;

  return createPortal(
    <div
      className={[
        "im-assistant-direct",
        micFlash && !micFading ? "im-assistant-direct--listening" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="assistant-direct-bubbles"
      role="status"
      aria-live="polite"
      aria-label={t("direct.aria")}
    >
      <div className="im-assistant-direct__stack pointer-events-none">
        {showPresence ? (
          <div
            className="im-assistant-direct__presence"
            data-testid={
              taskAdvisorPresence
                ? "assistant-task-advisor-presence"
                : "assistant-direct-presence"
            }
          >
            <span className="im-assistant-direct__presence-staff">
              <DirectAssistantAvatar label={displayName} src={identity.avatarDataUrl} />
              <span className="im-assistant-direct__presence-name">{displayName}</span>
            </span>
            {taskAdvisorPresence ? (
              <span className="im-assistant-direct__presence-staff">
                <DirectStaffAvatar staffId="taskEditor" label={taskAdvisorName} />
                <span className="im-assistant-direct__presence-name">{taskAdvisorName}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {readyVisible ? (
          <div
            className={[
              "text-caption leading-normal im-assistant-direct__hint",
              readyFading ? "im-assistant-direct__item--fade" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-testid="assistant-direct-ready"
          >
            {t("direct.readyHint")}
          </div>
        ) : null}

        {micFlash ? (
          <div className={rowClass(micFading)}>
            <DirectAssistantAvatar label={displayName} src={identity.avatarDataUrl} />
            <div
              className="im-assistant-direct__listening"
              data-testid="assistant-direct-listening"
            >
              <Mic size={14} strokeWidth={2.4} aria-hidden="true" />
              <span>{t("direct.listening")}</span>
              <span className="im-assistant-direct__pulse" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        ) : null}

        {showLiveDraft ? (
          <div className="im-assistant-direct__row">
            <DirectUserAvatar label={userDisplayName} src={profile.avatarDataUrl} />
            <div
              className="im-assistant-direct__bubble im-assistant-direct__bubble--user im-auto-scrollbar"
              data-testid="assistant-direct-stt-live"
            >
              {draftText}
            </div>
          </div>
        ) : null}

        {showUserFlash && userFlash ? (
          <div className={rowClass(userFlash.fading)}>
            <DirectUserAvatar label={userDisplayName} src={profile.avatarDataUrl} />
            <div
              className="im-assistant-direct__bubble im-assistant-direct__bubble--user im-auto-scrollbar"
              data-testid="assistant-direct-user-msg"
            >
              {userFlash.text}
            </div>
          </div>
        ) : null}

        {agentSending ? (
          <div className="im-assistant-direct__row">
            <DirectAssistantAvatar label={displayName} src={identity.avatarDataUrl} />
            <div className="im-assistant-direct__agent-body">
              {liveToolSteps.length > 0 ? (
                <AssistantLiveToolSteps
                  steps={liveToolSteps}
                  bare
                  attributeTaskAdvisor={taskAdvisorPresence}
                  testId="assistant-direct-live-tool-steps"
                />
              ) : null}
              <div
                className="text-caption leading-normal im-assistant-direct__hint"
                data-testid="assistant-direct-sending"
              >
                {t("quick.sending")}
              </div>
            </div>
          </div>
        ) : null}

        {showAgentReply && agentReply ? (
          <div className={rowClass(agentReply.fading)}>
            <DirectAssistantAvatar label={displayName} src={identity.avatarDataUrl} />
            <div
              className={`im-assistant-direct__bubble im-auto-scrollbar ${assistantChatBubbleClass("full")}`}
              data-testid="assistant-direct-msg"
            >
              <AssistantMarkdown text={agentReply.text} />
              {latestAssistant?.id === agentReply.key &&
              latestAssistant.toolCalls &&
              latestAssistant.toolCalls.length > 0 ? (
                <AssistantToolSummary
                  toolCalls={latestAssistant.toolCalls}
                  attributeTaskAdvisor={taskAdvisorPresence}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {composer}
    </div>,
    document.body,
  );
}
