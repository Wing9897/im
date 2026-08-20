/**
 * Clickable card-corner emoji avatar that opens a picker dialog.
 * Stops propagation so the parent card does not navigate/open on emoji clicks.
 * Uses ModalDialog (portal) so the picker is not clipped by card overflow.
 *
 * UX: each grid pick persists immediately via `onSelect` and closes on success.
 * Done also commits any pending draft so confirm never silently discards.
 * Dismiss (X / overlay / Escape / Done) always works — never blocked by save busy.
 * Parent owns `open`; trigger stays inert while open or until onExited.
 */

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmojiPickerDialog } from "./EmojiPickerDialog";
import { createEmojiPickerOpenLatch } from "./emojiPickerCloseGuard";
import { preloadEmojiPickerModule } from "./emojiPickerLoader";
import { ItemEmojiAvatar, type ItemEmojiAvatarSize } from "./ItemEmojiAvatar";

type Props = {
  emoji: string;
  /** When omitted, avatar is display-only (e.g. synthetic all-types card). */
  onSelect?: (emoji: string) => void | Promise<void>;
  /** Shown in the change-emoji button aria-label. */
  name: string;
  /** Optional round-chip tint (e.g. category color). */
  backgroundColor?: string | null;
  /** Round avatar size passed to {@link ItemEmojiAvatar}. */
  avatarSize?: ItemEmojiAvatarSize;
  disabled?: boolean;
  testId?: string;
};

export function ItemCardEmojiPicker({
  emoji,
  onSelect,
  name,
  backgroundColor,
  avatarSize = "sm",
  disabled = false,
  testId,
}: Props) {
  const { t } = useTranslation("items");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const latchRef = useRef(createEmojiPickerOpenLatch());
  /** Ignore late save success that would race a user-dismissed dialog. */
  const openGenerationRef = useRef(0);
  const openRef = useRef(false);

  const closePicker = useCallback(() => {
    if (!openRef.current) return;
    latchRef.current.blockOpen();
    openGenerationRef.current += 1;
    openRef.current = false;
    setOpen(false);
  }, []);

  const handleExited = useCallback(() => {
    latchRef.current.clearOpenBlock();
  }, []);

  const handlePick = useCallback(
    (next: string) => {
      if (!onSelect || busy || disabled) return;
      const generation = openGenerationRef.current;
      setBusy(true);
      void (async () => {
        try {
          await onSelect(next);
          // Only auto-close if still open on the same cycle (Done/X already
          // closed → openRef false; do not re-arm the reopen latch).
          if (openRef.current && generation === openGenerationRef.current) {
            closePicker();
          }
        } catch {
          // Parent surfaces the error (toast); keep dialog open for retry / Done.
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, closePicker, disabled, onSelect],
  );

  if (!onSelect) {
    return (
      <ItemEmojiAvatar
        emoji={emoji}
        size={avatarSize}
        label={name}
        backgroundColor={backgroundColor}
        className="pointer-events-none"
      />
    );
  }

  const openDialog = () => {
    if (disabled || busy || open) return;
    if (latchRef.current.isOpenBlocked()) return;
    preloadEmojiPickerModule();
    openRef.current = true;
    setOpen(true);
  };

  return (
    <div
      className="relative shrink-0"
      data-testid={testId ?? "item-card-emoji-picker"}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled || busy || open}
        aria-label={t("changeEmojiAria", { name })}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="item-card-emoji-trigger"
        className={[
          "appearance-none border-0 bg-transparent p-0 shadow-none",
          "rounded-full transition-opacity duration-150 ease-out",
          "hover:opacity-85",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          "focus-visible:ring-[color-mix(in_srgb,var(--accent)_40%,transparent)]",
          "focus-visible:ring-offset-[var(--surface-card)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        ].join(" ")}
        onMouseEnter={preloadEmojiPickerModule}
        onFocus={preloadEmojiPickerModule}
        onClick={(e) => {
          e.stopPropagation();
          openDialog();
        }}
      >
        <ItemEmojiAvatar
          emoji={emoji}
          size={avatarSize}
          backgroundColor={backgroundColor}
        />
      </button>

      <EmojiPickerDialog
        open={open}
        title={t("changeEmojiAria", { name })}
        onClose={closePicker}
        onExited={handleExited}
        previewEmoji={emoji}
        previewBackgroundColor={backgroundColor}
        onPick={handlePick}
        commitOnPick
        disabled={disabled || busy}
        testId="item-card-emoji-dialog"
        clearTestId="emoji-picker-clear"
      />
    </div>
  );
}
