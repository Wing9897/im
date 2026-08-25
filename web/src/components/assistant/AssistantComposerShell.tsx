import { type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextArea, captionClass } from "../ui";
import type { SpacePttMode } from "../../speech/voiceSettings";
import { AssistantMicButton } from "./AssistantMicButton";
import { WorksetTargetSelect } from "./WorksetTargetSelect";

export type AssistantComposerShellProps = {
  variant: "page" | "overlay";
  draft: string;
  onDraftChange: (value: string) => void;
  sending: boolean;
  listening: boolean;
  worksetId: string;
  onWorksetIdChange: (worksetId: string) => void;
  onSend: () => void | Promise<void>;
  sttAvailable: boolean;
  spacePttMode: SpacePttMode;
  startListening: () => void | Promise<void>;
  stopListening: (options?: { send?: boolean }) => void | Promise<void>;
  /** Extra send disable (e.g. AI engine unavailable or assistant slot unbound). */
  sendDisabled?: boolean;
  onDraftKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Overlay history panel above the workset row. */
  header?: ReactNode;
  /** Overlay clear button beside the textarea. */
  afterDraft?: ReactNode;
  /** Page TTS caption next to the mic. */
  leadingActions?: ReactNode;
  /** Overlay flash/persist toggle before Send. */
  extraActions?: ReactNode;
};

/**
 * Shared assistant composer: workset, draft, PTT, send.
 * Page and system-bar overlay keep separate chrome / test ids; routes stay split.
 */
export function AssistantComposerShell({
  variant,
  draft,
  onDraftChange,
  sending,
  listening,
  worksetId,
  onWorksetIdChange,
  onSend,
  sttAvailable,
  spacePttMode,
  startListening,
  stopListening,
  sendDisabled = false,
  onDraftKeyDown,
  header,
  afterDraft,
  leadingActions,
  extraActions,
}: AssistantComposerShellProps) {
  const { t } = useTranslation("assistant");
  const overlay = variant === "overlay";
  const draftId = overlay ? "assistant-caption-draft" : "assistant-draft";
  const worksetFieldId = overlay
    ? "assistant-caption-calendar-task"
    : "assistant-calendar-workset";
  const placeholder = listening
    ? t(overlay ? "quick.placeholderListening" : "draft.placeholderListening")
    : t(overlay ? "quick.placeholderIdle" : "draft.placeholderIdle");
  const blockedHint = sendDisabled ? t("send.disabledHint") : undefined;

  const trySend = () => {
    if (sending || sendDisabled) return;
    void onSend();
  };

  const worksetRow = (
    <div
      className={
        overlay
          ? "im-assistant-direct__composer-target"
          : "mb-sm flex flex-wrap items-center gap-sm"
      }
    >
      <label
        className={
          overlay
            ? "text-caption leading-normal im-assistant-direct__composer-target-label"
            : `${captionClass} shrink-0 text-text-muted`
        }
        htmlFor={worksetFieldId}
      >
        {t("targetWorkset.label")}
      </label>
      <WorksetTargetSelect
        id={worksetFieldId}
        value={worksetId}
        onChange={onWorksetIdChange}
        disabled={sending}
        className={
          overlay
            ? "im-assistant-direct__composer-target-select"
            : "min-w-[10rem] max-w-full flex-1 sm:max-w-xs"
        }
        data-testid={worksetFieldId}
      />
    </div>
  );

  const draftLabel = (
    <label className="sr-only" htmlFor={draftId}>
      {t(overlay ? "quick.draftLabel" : "draft.label")}
    </label>
  );

  const textarea = (
    <TextArea
      id={draftId}
      data-testid={draftId}
      value={draft}
      onChange={(event) => onDraftChange(event.target.value)}
      placeholder={placeholder}
      rows={overlay ? 2 : 3}
      className={overlay ? "im-assistant-direct__composer-input" : "min-h-[88px]"}
      disabled={sending}
      onKeyDown={(event) => {
        onDraftKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          trySend();
        }
      }}
    />
  );

  const mic = sttAvailable ? (
    <AssistantMicButton
      spacePttMode={spacePttMode}
      listening={listening}
      sending={sending}
      startListening={startListening}
      stopListening={stopListening}
      disabled={sendDisabled}
      size={overlay ? "sm" : "md"}
      className={overlay ? "im-assistant-direct__composer-mic" : undefined}
      testId={overlay ? "assistant-caption-ptt" : "assistant-ptt"}
    />
  ) : null;

  const sendButton = (
    <Button
      variant="primary"
      size={overlay ? "sm" : "md"}
      data-testid={overlay ? "assistant-caption-send" : "assistant-send"}
      onClick={trySend}
      disabled={sending || sendDisabled || !draft.trim()}
      title={blockedHint}
      aria-label={blockedHint}
    >
      {sending
        ? t(overlay ? "quick.sendingBtn" : "send.sending")
        : t(overlay ? "quick.send" : "send.label")}
    </Button>
  );

  if (overlay) {
    return (
      <div className="im-assistant-direct__composer" data-testid="assistant-caption-composer">
        {header}
        {draftLabel}
        {worksetRow}
        <div className="im-assistant-direct__composer-input-row">
          {textarea}
          {afterDraft}
        </div>
        <div className="im-assistant-direct__composer-actions">
          {mic}
          {extraActions}
          {sendButton}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-surface-border px-md py-md">
      {worksetRow}
      {draftLabel}
      {textarea}
      <div className="mt-sm flex flex-wrap items-center justify-between gap-md">
        <div className="flex flex-wrap items-center gap-sm">
          {mic}
          {leadingActions}
        </div>
        {sendButton}
      </div>
    </div>
  );
}
