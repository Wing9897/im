/**
 * 48px workset-card emoji avatar. Empty → Layers chip; set → ItemEmojiAvatar.
 * Picker matches Items card UX (portal dialog, commit-on-pick).
 */

import { Layers } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmojiPickerDialog } from "./items/emoji/EmojiPickerDialog";
import { createEmojiPickerOpenLatch } from "./items/emoji/emojiPickerCloseGuard";
import { preloadEmojiPickerModule } from "./items/emoji/emojiPickerLoader";
import { TaskLogoMark } from "./task/TaskLogoMark";

type Props = {
  emoji: string;
  name: string;
  onSelect: (emoji: string) => void | Promise<void>;
};

const WORKSET_AVATAR_PX = 48;

export function WorksetCardEmoji({ emoji, name, onSelect }: Props) {
  const { t } = useTranslation("workset");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const latchRef = useRef(createEmojiPickerOpenLatch());
  const openGenerationRef = useRef(0);
  const openRef = useRef(false);
  const glyph = emoji.trim();

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
      if (busy) return;
      const generation = openGenerationRef.current;
      setBusy(true);
      void (async () => {
        try {
          await onSelect(next);
          if (openRef.current && generation === openGenerationRef.current) {
            closePicker();
          }
        } catch {
          // Parent toasts; keep dialog open for retry.
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, closePicker, onSelect],
  );

  const openDialog = () => {
    if (busy || open) return;
    if (latchRef.current.isOpenBlocked()) return;
    preloadEmojiPickerModule();
    openRef.current = true;
    setOpen(true);
  };

  return (
    <div
      className="relative shrink-0"
      data-testid="workset-card-emoji"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={busy || open}
        aria-label={t("changeEmojiAria", { name })}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="workset-card-emoji-trigger"
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
        <TaskLogoMark
          emoji={glyph}
          sizePx={WORKSET_AVATAR_PX}
          fallbackIcon={Layers}
          testId="workset-logo-mark"
        />
      </button>
      <EmojiPickerDialog
        open={open}
        title={t("changeEmojiAria", { name })}
        onClose={closePicker}
        onExited={handleExited}
        previewEmoji={glyph}
        onPick={handlePick}
        commitOnPick
        disabled={busy}
        testId="workset-card-emoji-dialog"
        clearTestId="emoji-picker-clear"
      />
    </div>
  );
}
