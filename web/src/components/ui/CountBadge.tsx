interface CountBadgeProps {
  count: number;
  /** Accessible label, e.g. "12 項". */
  "aria-label"?: string;
  className?: string;
}

/** Accent-tinted count pill for panel section headers. */
export function CountBadge({ count, "aria-label": ariaLabel, className }: CountBadgeProps) {
  const cls = [
    "sources-count-badge inline-flex min-w-[22px] items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-sm py-0.5 text-card-meta font-bold text-accent",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} aria-label={ariaLabel}>
      {count}
    </span>
  );
}
