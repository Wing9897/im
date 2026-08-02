/**
 * Shared brand mark for item / category emoji in card titles and list rows.
 * Keeps glyph size and optical alignment consistent across the Items UI.
 */

type Props = {
  emoji: string;
  className?: string;
};

/** Fixed optical box so emoji neither dwarfs nor sinks relative to card titles. */
export function ItemEmojiMark({ emoji, className }: Props) {
  return (
    <span
      className={[
        "inline-flex h-[1.25em] w-[1.25em] shrink-0 items-center justify-center text-[1.05em] leading-none",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      {emoji}
    </span>
  );
}
