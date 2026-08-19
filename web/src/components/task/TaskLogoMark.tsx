import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ListChecks } from "lucide-react";

import {
  ItemEmojiAvatar,
  ITEM_EMOJI_CHIP_BG_CLASS,
  type ItemEmojiAvatarSize,
} from "../items/emoji/ItemEmojiAvatar";

/** Large task-card / schedule-card mark (emoji or Lucide). Keep in sync with ItemEmojiAvatar `task`. */
export const TASK_LOGO_MARK_PX = 38;
/** Timeline list / sidebar mark — slight bump from the old 22px chip. */
export const TASK_EVENT_MARK_PX = 28;
/** Overlay badge on the dual-avatar stacks. Keep in sync with ItemEmojiAvatar `badge`. */
export const TASK_LOGO_BADGE_PX = 18;
/** Compact overlay on the timeline intel dual-stack. Keep in sync with ItemEmojiAvatar `xs`. */
export const TASK_LOGO_COMPACT_BADGE_PX = 14;

function emojiAvatarSize(sizePx: number): ItemEmojiAvatarSize {
  if (sizePx >= TASK_LOGO_MARK_PX) return "task";
  if (sizePx >= TASK_EVENT_MARK_PX) return "md";
  if (sizePx >= 22) return "sm";
  if (sizePx >= TASK_LOGO_BADGE_PX) return "badge";
  return "xs";
}

type Props = {
  emoji: string;
  sizePx?: number;
  className?: string;
  /** Empty-state Lucide (task ListChecks, schedule CalendarDays / Repeat). */
  fallbackIcon?: LucideIcon;
  testId?: string;
};

/**
 * Large card identity: default Lucide logo, or a user emoji.
 * Never empty; never the AI staff head.
 */
export function TaskLogoMark({
  emoji,
  sizePx = TASK_LOGO_MARK_PX,
  className = "",
  fallbackIcon: FallbackIcon = ListChecks,
  testId = "task-logo-mark",
}: Props) {
  const glyph = emoji.trim();
  if (glyph) {
    return (
      <ItemEmojiAvatar
        emoji={glyph}
        size={emojiAvatarSize(sizePx)}
        className={className}
      />
    );
  }

  const style = {
    width: sizePx,
    height: sizePx,
  } as CSSProperties;
  const iconPx = Math.round(sizePx * 0.64);

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        ITEM_EMOJI_CHIP_BG_CLASS,
        "text-text-secondary",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-hidden
      data-testid={testId}
    >
      <FallbackIcon size={iconPx} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}
