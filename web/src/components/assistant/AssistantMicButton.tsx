import { Mic } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui";
import { useAssistantMicPtt } from "../../hooks/useAssistantMicPtt";
import type { SpacePttMode } from "../../speech/voiceSettings";

type AssistantMicButtonProps = {
  spacePttMode: SpacePttMode;
  listening: boolean;
  sending: boolean;
  startListening: () => void | Promise<void>;
  stopListening: (options?: { send?: boolean }) => void | Promise<void>;
  /** Extra disable (e.g. AI engine / assistant slot not ready). */
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** Default: ``assistant-ptt`` (full page). Quick uses ``assistant-caption-ptt``. */
  testId?: string;
};

/**
 * Hold / toggle mic control shared by `/assistant` and Quick composer.
 * Labels follow ``spacePttMode``; gesture handling lives in ``useAssistantMicPtt``.
 */
export function AssistantMicButton({
  spacePttMode,
  listening,
  sending,
  startListening,
  stopListening,
  disabled = false,
  size = "md",
  className,
  testId = "assistant-ptt",
}: AssistantMicButtonProps) {
  const { t } = useTranslation("assistant");
  const {
    onMicPointerDown,
    onMicPointerUp,
    onMicClick,
    micToggleMode,
    holding,
  } = useAssistantMicPtt({
    spacePttMode,
    listening,
    sending,
    startListening,
    stopListening,
  });

  // Hold: show active chrome from pointerdown (``holding``), not only after STT
  // ``listening`` flips — otherwise the label swap steals capture mid-press.
  // Keep Mic icon always (no Mic↔Square swap) so the pointer capture target
  // stays stable; active state is variant / label / aria only.
  const active = micToggleMode ? listening : holding || listening;

  const idleAria = micToggleMode ? t("mic.tapIdleAria") : t("quick.micIdleAria");
  const idleTitle = micToggleMode ? t("mic.tapIdleTitle") : t("quick.micIdleTitle");
  const idleLabel = micToggleMode ? t("mic.tapToTalk") : t("mic.holdToTalk");
  const activeAria = micToggleMode ? t("mic.tapToStopAria") : t("mic.releaseToStopAria");
  const activeTitle = micToggleMode ? t("mic.tapToStop") : t("mic.releaseToStop");
  const activeLabel = micToggleMode ? t("mic.tapToStop") : t("mic.releaseToStop");

  return (
    <Button
      variant={active ? "primary" : "secondary"}
      size={size}
      className={className}
      aria-label={active ? activeAria : idleAria}
      aria-pressed={active}
      data-testid={testId}
      data-ptt-mode={micToggleMode ? "toggle" : "hold"}
      data-holding={holding ? "true" : undefined}
      title={active ? activeTitle : idleTitle}
      onPointerDown={onMicPointerDown}
      onPointerUp={onMicPointerUp}
      onClick={onMicClick}
      disabled={sending || disabled}
    >
      <Mic className="mr-1 inline size-3.5" aria-hidden />
      {active ? activeLabel : idleLabel}
    </Button>
  );
}
