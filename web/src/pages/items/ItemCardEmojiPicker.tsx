/**
 * Clickable card-corner emoji avatar that opens a picker dialog.
 * Stops propagation so the parent card does not navigate/open on emoji clicks.
 * Uses ModalDialog (portal) so the picker is not clipped by card overflow.
 */

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmojiPickerDialog } from "./EmojiPickerDialog";
import { preloadEmojiPickerModule } from "./emojiPickerLoader";
import { ItemEmojiAvatar } from "./ItemEmojiAvatar";

type Props = {
  emoji: string;
  /** When omitted, avatar is display-only (e.g. synthetic all-types card). */
  onSelect?: (emoji: string) => void | Promise<void>;
  /** Shown in the change-emoji button aria-label. */
  name: string;
  /** Optional round-chip tint (e.g. category color). */
  backgroundColor?: string | null;
  disabled?: boolean;
  testId?: string;
};

export function ItemCardEmojiPicker({
  emoji,
  onSelect,
  name,
  backgroundColor,
  disabled = false,
  testId,
}: Props) {
  const { t } = useTranslation("items");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emoji);
  const [busy, setBusy] = useState(false);

  const handlePick = useCallback(
    (next: string) => {
      setDraft(next);
      if (!onSelect || busy || disabled) return;
      setBusy(true);
      void Promise.resolve(onSelect(next))
        .then(() => {
          setOpen(false);
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [busy, disabled, onSelect],
  );

  if (!onSelect) {
    return (
      <ItemEmojiAvatar
        emoji={emoji}
        size="sm"
        label={name}
        backgroundColor={backgroundColor}
        className="pointer-events-none"
      />
    );
  }

  const openDialog = () => {
    if (disabled || busy) return;
    preloadEmojiPickerModule();
    setDraft(emoji);
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
        disabled={disabled || busy}
        aria-label={t("changeEmojiAria", { name })}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="item-card-emoji-trigger"
        className={[
          "appearance-none border-0 bg-transparent p-0 shadow-none",
          "rounded-full transition-[opacity,transform] duration-150 ease-out",
          "hover:opacity-85 active:scale-[0.97]",
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
          size="sm"
          backgroundColor={backgroundColor}
        />
      </button>

      <EmojiPickerDialog
        open={open}
        title={t("changeEmojiAria", { name })}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        previewEmoji={draft.trim() || emoji}
        previewBackgroundColor={backgroundColor}
        onPick={handlePick}
        onClear={
          draft.trim() || emoji.trim() ? () => handlePick("") : undefined
        }
        disabled={disabled || busy}
        testId="item-card-emoji-dialog"
        clearTestId="emoji-picker-clear"
      />
    </div>
  );
}
