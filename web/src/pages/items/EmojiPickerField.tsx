import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui";
import { EmojiPickerDialog } from "./EmojiPickerDialog";
import { preloadEmojiPickerModule } from "./emojiPickerLoader";
import { ItemEmojiAvatar, ItemEmojiEmptyPlaceholder } from "./ItemEmojiAvatar";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Shown muted in the preview when `value` is empty (e.g. category default). */
  placeholder?: string;
  /** Override dialog title (defaults to field label context). */
  dialogTitle?: string;
};

/**
 * Compact emoji control: avatar + actions; full keyboard opens in ModalDialog.
 * Does not embed the picker inline (desk density).
 */
export function EmojiPickerField({
  id,
  value,
  onChange,
  disabled = false,
  placeholder,
  dialogTitle,
}: Props) {
  const { t } = useTranslation("items");
  const [open, setOpen] = useState(false);
  const trimmed = value.trim();
  const preview = trimmed || placeholder?.trim() || "";
  const previewIsPlaceholder = !trimmed && Boolean(placeholder?.trim());

  const openPicker = () => {
    if (disabled) return;
    preloadEmojiPickerModule();
    setOpen(true);
  };

  const closePicker = useCallback(() => setOpen(false), []);

  const handlePick = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-xs" data-testid="emoji-picker-field">
      <div className="flex flex-wrap items-center gap-xs">
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={
            trimmed
              ? t("emojiSelectedAria", { emoji: trimmed })
              : placeholder?.trim()
                ? t("emojiPlaceholderAria", { emoji: placeholder.trim() })
                : t("emojiEmptyAria")
          }
          data-testid="emoji-picker-trigger"
          className={[
            "inline-flex items-center gap-xs rounded-md border border-surface-border/70",
            "bg-[color-mix(in_srgb,var(--surface-raised)_40%,var(--surface-card))] px-xs py-0.5",
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

      <EmojiPickerDialog
        open={open}
        title={dialogTitle ?? t("emojiPickerTitle")}
        onClose={closePicker}
        previewEmoji={preview}
        onPick={handlePick}
        onClear={trimmed ? () => onChange("") : undefined}
        disabled={disabled}
        testId="emoji-picker-field-dialog"
      />
    </div>
  );
}
