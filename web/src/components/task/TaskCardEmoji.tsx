/**
 * Clickable two-avatar stack that opens the shared emoji picker.
 * Empty pick → delete prefs key → default task logo. AI head stays the overlay.
 */

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { EmojiPickerDialog } from "../items/emoji/EmojiPickerDialog";
import { createEmojiPickerOpenLatch } from "../items/emoji/emojiPickerCloseGuard";
import { preloadEmojiPickerModule } from "../items/emoji/emojiPickerLoader";
import { TaskAvatarStack } from "./TaskAvatarStack";
import type { TaskEmployeeId } from "../../domain/tasks/taskEmployee";

type Props = {
  emoji: string;
  name: string;
  employeeId: TaskEmployeeId;
  employeeName?: string;
  onSelect: (emoji: string) => void | Promise<void>;
  disabled?: boolean;
};

export function TaskCardEmoji({
  emoji,
  name,
  employeeId,
  employeeName,
  onSelect,
  disabled = false,
}: Props) {
  const { t } = useTranslation("tasks");
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
    if (disabled || busy || open) return;
    if (latchRef.current.isOpenBlocked()) return;
    preloadEmojiPickerModule();
    openRef.current = true;
    setOpen(true);
  };

  return (
    <div
      className="relative shrink-0"
      data-testid="task-card-emoji"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled || busy || open}
        aria-label={t("card.changeEmojiAria", { name })}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="task-card-emoji-trigger"
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
        <TaskAvatarStack
          emoji={glyph}
          employeeId={employeeId}
          employeeName={employeeName}
        />
      </button>
      <EmojiPickerDialog
        open={open}
        title={t("card.changeEmojiAria", { name })}
        onClose={closePicker}
        onExited={handleExited}
        previewEmoji={glyph}
        onPick={handlePick}
        commitOnPick
        disabled={busy}
        testId="task-card-emoji-dialog"
        clearTestId="emoji-picker-clear"
      />
    </div>
  );
}
