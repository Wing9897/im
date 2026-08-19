/**
 * Circular emoji avatar for item / category cards — round chip with fill, no dark border.
 */

import type { CSSProperties } from "react";

const SIZE_PX = {
  /** Compact overlay on timeline intel dual-stack (~14px). */
  xs: 14,
  /** Card overlay on task / intel dual-stack. Keep in sync with AI staff `badge`. */
  badge: 18,
  sm: 22,
  md: 28,
  /** Task-card large mark (logo / picked emoji). Keep in sync with TASK_LOGO_MARK_PX. */
  task: 38,
  /** Entry-list ID-card avatar. */
  card: 48,
  /** CV / form identity avatar — fills the résumé circle slot. */
  lg: 72,
} as const;

const GLYPH_CLASS = {
  xs: "text-[0.6rem] leading-none",
  badge: "text-[0.8rem] leading-none",
  sm: "text-[0.95rem] leading-none",
  md: "text-[1.2rem] leading-none",
  task: "text-[1.55rem] leading-none",
  card: "text-[1.65rem] leading-none",
  lg: "text-[2.25rem] leading-none",
} as const;

/** Soft disk behind the glyph when no category/item tint is provided. */
export const ITEM_EMOJI_CHIP_BG_CLASS =
  "bg-[color-mix(in_srgb,var(--surface-overlay)_65%,var(--surface-raised))]";

export function itemEmojiChipBackground(
  color: string | null | undefined,
): string | undefined {
  const trimmed = color?.trim();
  if (!trimmed) return undefined;
  return `color-mix(in_srgb, ${trimmed} 30%, var(--surface-raised))`;
}

export type ItemEmojiAvatarSize = keyof typeof SIZE_PX;

type Props = {
  emoji: string;
  size?: ItemEmojiAvatarSize;
  /** Optional tint (e.g. category color) — fills the round chip. */
  backgroundColor?: string | null;
  /** Accessible name; decorative when omitted. */
  label?: string;
  className?: string;
};

export function ItemEmojiAvatar({
  emoji,
  size = "md",
  backgroundColor,
  label,
  className = "",
}: Props) {
  const px = SIZE_PX[size];
  const tint = itemEmojiChipBackground(backgroundColor);
  const style = {
    width: px,
    height: px,
    border: "none",
    boxShadow: "none",
    ...(tint ? { backgroundColor: tint } : null),
  } as CSSProperties;

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border-0 border-transparent shadow-none outline-none ring-0",
        tint ? "" : ITEM_EMOJI_CHIP_BG_CLASS,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="item-emoji-avatar"
      data-emoji-chip={tint ? "tinted" : "default"}
    >
      <span className={`${GLYPH_CLASS[size]} select-none`} aria-hidden>
        {emoji}
      </span>
    </span>
  );
}

/** Empty-state chip used by emoji field/dialog when no glyph is selected. */
export function ItemEmojiEmptyPlaceholder() {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full ${ITEM_EMOJI_CHIP_BG_CLASS} text-caption text-text-muted`}
      aria-hidden
      data-testid="item-emoji-empty"
    >
      —
    </span>
  );
}
