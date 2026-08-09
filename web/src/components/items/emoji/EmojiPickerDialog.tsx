import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../ModalDialog";
import { Button, captionClass } from "../../ui";
import { EmojiPickerPanel, DEFAULT_EMOJI_PICKER_HEIGHT } from "./EmojiPickerPanel";
import { ItemEmojiAvatar, ItemEmojiEmptyPlaceholder } from "./ItemEmojiAvatar";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  /**
   * Called after the dialog has fully exited (not while the exit shell still
   * covers the page). Parents use this to clear reopen blocks.
   */
  onExited?: () => void;
  /**
   * Committed emoji used to seed draft when the dialog opens.
   * Do not pass display-only placeholders here — use `placeholderEmoji`.
   */
  previewEmoji: string;
  /** Shown when draft is empty (e.g. category default) — never committed by Done. */
  placeholderEmoji?: string;
  /** Optional round-chip tint for the preview avatar. */
  previewBackgroundColor?: string | null;
  /**
   * Commit the selected emoji.
   * - Default: called from Done after the dialog has fully dismissed.
   * - With `commitOnPick`: also called on each grid selection (card async save).
   */
  onPick: (emoji: string) => void;
  disabled?: boolean;
  /**
   * When true, each grid pick calls `onPick` immediately (card persist + close).
   * Done still commits draft if it differs from the open-time value, then closes.
   */
  commitOnPick?: boolean;
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
 * Open ownership: parent passes `open`; this dialog never sets it back to true.
 *
 * Selection model:
 * - Grid clicks update an internal draft (preview).
 * - Done closes synchronously, then commits draft via `onPick` only after
 *   `onExited` (exit animation finished / unmounted) so commit re-renders and
 *   pointer events cannot revive a still-visible shell.
 * - `commitOnPick` also fires `onPick` on each click (card async save UX).
 *
 * Perf: grid mount is deferred until after modal paint. Dialog unmounts on
 * close (no keepMounted) so parked-layer / enter-animation races cannot
 * visually reopen the picker.
 */
export function EmojiPickerDialog({
  open,
  title,
  onClose,
  onExited,
  previewEmoji,
  placeholderEmoji,
  previewBackgroundColor,
  onPick,
  disabled = false,
  commitOnPick = false,
  testId,
  clearTestId,
  height = DEFAULT_EMOJI_PICKER_HEIGHT,
}: Props) {
  const { t } = useTranslation("items");
  const committed = previewEmoji.trim();
  const placeholder = placeholderEmoji?.trim() || "";
  const [draft, setDraft] = useState(committed);
  const [gridReady, setGridReady] = useState(false);
  const wasOpenRef = useRef(false);
  /** Seed snapshot when the dialog opened — Done compares against this for commitOnPick. */
  const openedWithRef = useRef(committed);
  /** Stash Done commit until ModalDialog reports full dismiss. */
  const pendingCommitRef = useRef<string | null>(null);
  const hasPendingCommitRef = useRef(false);
  /** Prevent double-dismiss from pointerdown + click. */
  const doneArmedRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(committed);
      openedWithRef.current = committed;
      pendingCommitRef.current = null;
      hasPendingCommitRef.current = false;
      doneArmedRef.current = false;
    }
    if (!open) {
      doneArmedRef.current = false;
    }
    wasOpenRef.current = open;
  }, [open, committed]);

  useEffect(() => {
    if (!open) return;
    if (gridReady) return;
    return afterNextPaint(() => {
      startTransition(() => setGridReady(true));
    });
  }, [open, gridReady]);

  const draftTrimmed = draft.trim();
  const preview = draftTrimmed || placeholder;
  const canClear = Boolean(draftTrimmed || committed);

  const handleGridPick = (emoji: string) => {
    setDraft(emoji);
    if (commitOnPick) {
      onPick(emoji);
    }
  };

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDraft("");
    if (commitOnPick) {
      onPick("");
    }
  };

  const beginDoneClose = () => {
    if (disabled || doneArmedRef.current) return;
    doneArmedRef.current = true;
    const value = draftTrimmed;
    const shouldCommit = !commitOnPick || value !== openedWithRef.current;
    hasPendingCommitRef.current = shouldCommit;
    pendingCommitRef.current = shouldCommit ? value : null;
    // Close immediately — commit waits for onExited.
    onClose();
  };

  const handleDonePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Close on pointerdown + preventDefault so the completing click cannot
    // land on a trigger under an exiting (or already-unmounted) overlay.
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    beginDoneClose();
  };

  const handleDoneClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Keyboard activation (Enter/Space) synthesizes click without pointerdown.
    beginDoneClose();
  };

  const handleExited = () => {
    if (hasPendingCommitRef.current) {
      hasPendingCommitRef.current = false;
      const value = pendingCommitRef.current ?? "";
      pendingCommitRef.current = null;
      onPick(value);
    }
    onExited?.();
  };

  return (
    <ModalDialog
      open={open}
      title={title}
      onClose={onClose}
      onExited={handleExited}
      size="default"
      bodyClassName="py-xs"
      testId={testId}
      footerJustify="space-between"
      footer={
        <>
          <p className={`m-0 max-w-[28ch] ${captionClass}`}>{t("emojiHint")}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onPointerDown={handleDonePointerDown}
            onClick={handleDoneClick}
            data-testid="emoji-picker-done"
          >
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
          {canClear ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              data-testid={clearTestId ?? "emoji-picker-dialog-clear"}
              onClick={handleClear}
            >
              {t("emojiClear")}
            </Button>
          ) : null}
        </div>
        {gridReady ? (
          <EmojiPickerPanel onChange={handleGridPick} disabled={disabled} height={height} />
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
