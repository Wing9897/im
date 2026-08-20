/**
 * Title-row emoji for schedule cards (~38px, same as task-card large mark).
 * Empty → CalendarDays / Repeat chip; set → emoji glyph. No AI overlay.
 * Picker matches Items card UX (portal dialog, commit-on-pick).
 */

import type { LucideIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmojiPickerDialog } from "../../components/items/emoji/EmojiPickerDialog";
import { createEmojiPickerOpenLatch } from "../../components/items/emoji/emojiPickerCloseGuard";
import { preloadEmojiPickerModule } from "../../components/items/emoji/emojiPickerLoader";
import { TaskLogoMark } from "../../components/task/TaskLogoMark";

type Props = {
  emoji: string;
  name: string;
  defaultIcon: LucideIcon;
  onSelect: (emoji: string) => void | Promise<void>;
};

export function ScheduleCardEmoji({ emoji, name, defaultIcon, onSelect }: Props) {
  const { t } = useTranslation("schedule");
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
      data-testid="schedule-card-emoji"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={busy || open}
        aria-label={t("card.changeEmojiAria", { title: name })}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="schedule-card-emoji-trigger"
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
          fallbackIcon={defaultIcon}
          testId="schedule-logo-mark"
        />
      </button>
      <EmojiPickerDialog
        open={open}
        title={t("card.changeEmojiAria", { title: name })}
        onClose={closePicker}
        onExited={handleExited}
        previewEmoji={glyph}
        onPick={handlePick}
        commitOnPick
        disabled={busy}
        testId="schedule-card-emoji-dialog"
        clearTestId="emoji-picker-clear"
      />
    </div>
  );
}
