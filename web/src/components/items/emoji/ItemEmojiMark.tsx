/**
 * Shared brand mark for item / category emoji in list rows.
 * Round chip with the same fill language as {@link ItemEmojiAvatar}.
 */

import {
  ITEM_EMOJI_CHIP_BG_CLASS,
  itemEmojiChipBackground,
} from "./ItemEmojiAvatar";

type Props = {
  emoji: string;
  /** Optional tint (e.g. category color) — fills the round chip. */
  backgroundColor?: string | null;
  className?: string;
};

/** Fixed optical box so emoji neither dwarfs nor sinks relative to card titles. */
export function ItemEmojiMark({ emoji, backgroundColor, className }: Props) {
  const tint = itemEmojiChipBackground(backgroundColor);

  return (
    <span
      className={[
        "inline-flex h-[1.35em] w-[1.35em] shrink-0 items-center justify-center",
        "overflow-hidden rounded-full text-[1.05em] leading-none",
        tint ? "" : ITEM_EMOJI_CHIP_BG_CLASS,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={tint ? { backgroundColor: tint } : undefined}
      aria-hidden
      data-testid="item-emoji-mark"
      data-emoji-chip={tint ? "tinted" : "default"}
    >
      {emoji}
    </span>
  );
}
