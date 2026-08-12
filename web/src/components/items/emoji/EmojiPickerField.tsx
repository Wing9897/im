import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PenLine, X } from "lucide-react";
import { Button } from "../../ui";
import { EmojiPickerDialog } from "./EmojiPickerDialog";
import { createEmojiPickerOpenLatch } from "./emojiPickerCloseGuard";
import { preloadEmojiPickerModule } from "./emojiPickerLoader";
import {
  ITEM_EMOJI_CHIP_BG_CLASS,
  ItemEmojiAvatar,
  ItemEmojiEmptyPlaceholder,
} from "./ItemEmojiAvatar";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Shown muted in the preview when `value` is empty (e.g. category default). */
  placeholder?: string;
  /** Override dialog title (defaults to field label context). */
  dialogTitle?: string;
  /**
   * `field` — compact chip + label (category forms).
   * `avatar` — large circular résumé slot (item form CV header); same circle
   * later hosts an image via `object-cover`.
   */
  variant?: "field" | "avatar";
};

/**
 * Compact emoji control: avatar + actions; full keyboard opens in ModalDialog.
 * Does not embed the picker inline (desk density).
 *
 * Dialog UX: grid clicks update a draft preview; Done commits via `onChange`
 * after the dialog has fully exited. Parent owns `open` exclusively.
 */
export function EmojiPickerField({
  id,
  value,
  onChange,
  disabled = false,
  placeholder,
  dialogTitle,
  variant = "field",
}: Props) {
  const { t } = useTranslation("items");
  const [open, setOpen] = useState(false);
  const latchRef = useRef(createEmojiPickerOpenLatch());
  const trimmed = value.trim();
  const placeholderTrimmed = placeholder?.trim() || "";
  const preview = trimmed || placeholderTrimmed;
  const previewIsPlaceholder = !trimmed && Boolean(placeholderTrimmed);

  const openPicker = () => {
    if (disabled || open) return;
    if (latchRef.current.isOpenBlocked()) return;
    preloadEmojiPickerModule();
    setOpen(true);
  };

  const closePicker = useCallback(() => {
    latchRef.current.blockOpen();
    setOpen(false);
  }, []);

  const handleExited = useCallback(() => {
    latchRef.current.clearOpenBlock();
  }, []);

  const handleCommit = useCallback(
    (next: string) => {
      onChange(next);
    },
    [onChange],
  );

  const ariaLabel = trimmed
    ? t("emojiSelectedAria", { emoji: trimmed })
    : placeholderTrimmed
      ? t("emojiPlaceholderAria", { emoji: placeholderTrimmed })
      : t("emojiEmptyAria");

  const dialog = (
    <EmojiPickerDialog
      open={open}
      title={dialogTitle ?? t("emojiPickerTitle")}
      onClose={closePicker}
      onExited={handleExited}
      previewEmoji={trimmed}
      placeholderEmoji={placeholderTrimmed || undefined}
      onPick={handleCommit}
      disabled={disabled}
      testId="emoji-picker-field-dialog"
      clearTestId="emoji-picker-dialog-clear"
    />
  );

  if (variant === "avatar") {
    return (
      <div
        className="group/avatar relative flex shrink-0 items-start"
        data-testid="emoji-picker-field"
        data-variant="avatar"
      >
        <button
          type="button"
          id={id}
          disabled={disabled || open}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel}
          data-testid="emoji-picker-trigger"
          className={[
            "relative inline-flex h-[5.25rem] w-[5.25rem] shrink-0 items-center justify-center",
            "overflow-hidden rounded-full border border-surface-border/60",
            "transition-[border-color,opacity,transform] duration-150 ease-out",
            "hover:border-surface-border active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            previewIsPlaceholder ? "opacity-80" : "",
            preview ? "" : ITEM_EMOJI_CHIP_BG_CLASS,
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseEnter={preloadEmojiPickerModule}
          onFocus={preloadEmojiPickerModule}
          onClick={openPicker}
        >
          {/* Image slot: swap emoji for <img className="h-full w-full object-cover" /> later. */}
          {preview ? (
            <ItemEmojiAvatar
              emoji={preview}
              size="lg"
              className="pointer-events-none h-full w-full"
            />
          ) : (
            <ItemEmojiEmptyPlaceholder />
          )}
          <span
            className={[
              "pointer-events-none absolute inset-0 flex items-center justify-center",
              "bg-[color-mix(in_srgb,var(--surface-base)_55%,transparent)] text-text-primary",
              "opacity-0 transition-opacity duration-150",
              "group-hover/avatar:opacity-100 group-focus-within/avatar:opacity-100",
            ].join(" ")}
            aria-hidden
          >
            <PenLine size={18} strokeWidth={1.75} />
          </span>
        </button>
        {trimmed ? (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            data-testid="emoji-picker-clear"
            aria-label={t("emojiClear")}
            className={[
              "absolute -right-0.5 -top-0.5 z-10 inline-flex h-6 w-6 items-center justify-center",
              "im-surface-panel rounded-full border border-surface-border/70 text-text-secondary shadow-sm",
              "opacity-0 transition-opacity duration-150",
              "hover:border-surface-border hover:text-text-primary",
              "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]",
              "group-hover/avatar:opacity-100 group-focus-within/avatar:opacity-100",
              "disabled:cursor-not-allowed disabled:opacity-40",
            ].join(" ")}
          >
            <X size={12} strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
        {dialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-xs" data-testid="emoji-picker-field">
      <div className="flex flex-wrap items-center gap-xs">
        <button
          type="button"
          id={id}
          disabled={disabled || open}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel}
          data-testid="emoji-picker-trigger"
          className={[
            "im-surface-inset inline-flex items-center gap-xs rounded-md border border-surface-border/70",
            "px-xs py-0.5",
            "text-caption text-text-secondary transition-[border-color,background,color,opacity] duration-150 ease-out",
            "hover:border-surface-border hover:text-text-primary",
            "active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            previewIsPlaceholder ? "opacity-80" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseEnter={preloadEmojiPickerModule}
          onFocus={preloadEmojiPickerModule}
          onClick={openPicker}
        >
          {preview ? (
            <ItemEmojiAvatar emoji={preview} size="sm" />
          ) : (
            <ItemEmojiEmptyPlaceholder />
          )}
          <span className="pr-0.5">{trimmed ? t("emojiChange") : t("emojiChoose")}</span>
        </button>
        {trimmed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange("")}
            data-testid="emoji-picker-clear"
          >
            {t("emojiClear")}
          </Button>
        ) : null}
      </div>

      {dialog}
    </div>
  );
}
