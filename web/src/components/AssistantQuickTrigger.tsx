import { MessageSquare, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isAssistantDirectModeSupported } from "../domain/assistant/directModeSupport";
import { useAssistantQuick } from "../hooks/useAssistantQuick";

interface AssistantQuickTriggerProps {
  compact?: boolean;
}

/**
 * Chrome actions for the always-on voice assistant — right of the title-bar search.
 * Chat button opens text composer; clear lives next to that composer input.
 * Space PTT only when STT is actually available.
 */
export function AssistantQuickTrigger({ compact: _compact = false }: AssistantQuickTriggerProps) {
  void _compact;
  const { t } = useTranslation(["assistant", "common"]);
  const {
    captionActive,
    composerOpen,
    captionListening,
    chatActions,
    toggleComposer,
  } = useAssistantQuick();

  const speaking = Boolean(chatActions?.speaking);
  const sttAvailable =
    chatActions?.sttAvailable ?? isAssistantDirectModeSupported();
  const showChrome = captionActive;
  const listeningChrome = captionListening && sttAvailable;

  const composerLabel = composerOpen
    ? t("quick.openComposerActive")
    : sttAvailable
      ? t("quick.openComposer")
      : t("quick.openComposerNoVoice");

  const slotHidden = !showChrome ? " im-assistant-chrome__slot--hidden" : "";

  return (
    <div className="im-assistant-chrome" data-testid="assistant-chrome">
      {speaking ? (
        <button
          type="button"
          className={`im-command-trigger im-command-trigger--compact${slotHidden}`}
          data-testid="assistant-chrome-stop-speaking"
          aria-label={t("quick.stopSpeaking")}
          title={t("quick.stopSpeaking")}
          disabled={!showChrome}
          aria-hidden={!showChrome}
          tabIndex={showChrome ? 0 : -1}
          onClick={() => chatActions?.stopSpeaking()}
        >
          <VolumeX size={14} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : null}
      <button
        type="button"
        className={[
          "im-command-trigger im-command-trigger--compact",
          slotHidden,
          composerOpen ? "im-command-trigger--caption" : "",
          listeningChrome ? "im-command-trigger--listening" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-testid="assistant-chrome-composer"
        data-listening={listeningChrome ? "true" : undefined}
        data-stt-available={sttAvailable ? "true" : "false"}
        aria-label={composerLabel}
        title={composerLabel}
        aria-pressed={composerOpen}
        disabled={!showChrome}
        aria-hidden={!showChrome}
        tabIndex={showChrome ? 0 : -1}
        onClick={() => toggleComposer()}
      >
        <MessageSquare size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
