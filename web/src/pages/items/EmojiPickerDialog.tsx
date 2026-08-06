import { startTransition, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../components/ModalDialog";
import { Button, captionClass } from "../../components/ui";
import { EmojiPickerPanel, DEFAULT_EMOJI_PICKER_HEIGHT } from "./EmojiPickerPanel";
import { ItemEmojiAvatar, ItemEmojiEmptyPlaceholder } from "./ItemEmojiAvatar";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Preview glyph in the dialog header row. */
  previewEmoji: string;
  /** Optional round-chip tint for the preview avatar. */
  previewBackgroundColor?: string | null;
  onPick: (emoji: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  testId?: string;
  clearTestId?: string;
  height?: number;
};

/**
 * Schedule work after the browser paints the current frame (double rAF).
 * Lets ModalDialog chrome animate in before the heavy emoji grid mounts.
 */
function afterNextPaint(callback: () => void): () => void {
  let raf2 = 0;
  const raf1 = window.requestAnimationFrame(() => {
    raf2 = window.requestAnimationFrame(callback);
  });
  return () => {
    window.cancelAnimationFrame(raf1);
    window.cancelAnimationFrame(raf2);
  };
}

/**
 * Shared ModalDialog host for emoji-picker-react.
 * Trigger chrome stays in {@link EmojiPickerField} / {@link ItemCardEmojiPicker}.
 *
 * Perf:
 * - `keepMounted` parks the dialog tree (HTML hidden) after first open so reopen
 *   does not remount thousands of emoji buttons.
 * - Grid mount is deferred until after modal paint to avoid main-thread contention
 *   with enter animation.
 */
export function EmojiPickerDialog({
  open,
  title,
  onClose,
  previewEmoji,
  previewBackgroundColor,
  onPick,
  onClear,
  disabled = false,
  testId,
  clearTestId,
  height = DEFAULT_EMOJI_PICKER_HEIGHT,
}: Props) {
  const { t } = useTranslation("items");
  const preview = previewEmoji.trim();
  const [gridReady, setGridReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (gridReady) return;
    return afterNextPaint(() => {
      startTransition(() => setGridReady(true));
    });
  }, [open, gridReady]);

  return (
    <ModalDialog
      open={open}
      title={title}
      onClose={onClose}
      size="default"
      bodyClassName="py-xs"
      testId={testId}
      keepMounted
      footerJustify="space-between"
      footer={
        <>
          <p className={`m-0 max-w-[28ch] ${captionClass}`}>{t("emojiHint")}</p>
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onClose}>
            {t("done")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-xs">
        <div className="flex min-h-6 items-center gap-xs" aria-live="polite">
          {preview ? (
            <ItemEmojiAvatar
              emoji={preview}
              size="sm"
              backgroundColor={previewBackgroundColor}
            />
          ) : (
            <ItemEmojiEmptyPlaceholder />
          )}
          {preview && onClear ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              data-testid={clearTestId}
              onClick={onClear}
            >
              {t("emojiClear")}
            </Button>
          ) : null}
        </div>
        {gridReady ? (
          <EmojiPickerPanel onChange={onPick} disabled={disabled} height={height} />
        ) : (
          <div
            className="flex items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--surface-raised)_35%,transparent)] text-caption text-text-muted"
            style={{ height }}
            data-testid="emoji-picker-deferred"
            aria-hidden="true"
          />
        )}
      </div>
    </ModalDialog>
  );
}
