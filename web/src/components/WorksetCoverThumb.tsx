/**
 * Display-only workset cover thumbnail (~20–24px) for lists, filters, and board chrome.
 */

import { resolveWorksetCoverSrc } from "../domain/worksets/worksetCover";

type Props = {
  cover?: string | null;
  name: string;
  /** `sm` ≈ 22px, `md` ≈ 24px. */
  size?: "sm" | "md";
  className?: string;
  testId?: string;
};

const sizeClass: Record<NonNullable<Props["size"]>, string> = {
  sm: "size-[22px] min-w-[22px]",
  md: "size-6 min-w-6",
};

/** Compact workset cover mark — no upload / edit affordances. */
export function WorksetCoverThumb({
  cover,
  name,
  size = "sm",
  className,
  testId,
}: Props) {
  const src = resolveWorksetCoverSrc(cover);
  return (
    <img
      src={src}
      alt=""
      title={name}
      aria-hidden="true"
      data-testid={testId}
      className={[
        "shrink-0 rounded object-cover ring-1 ring-inset ring-[color-mix(in_srgb,var(--text-primary)_18%,var(--surface-border))]",
        sizeClass[size],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
