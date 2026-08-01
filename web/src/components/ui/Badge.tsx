import type { HTMLAttributes } from "react";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClass: Record<BadgeTone, string> = {
  neutral:
    "bg-[color-mix(in_srgb,var(--surface-border)_55%,transparent)] text-text-secondary",
  accent: "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent",
  success: "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success",
  warning: "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-warning",
  danger: "bg-[color-mix(in_srgb,var(--error)_16%,transparent)] text-error",
  info: "bg-[color-mix(in_srgb,var(--info)_16%,transparent)] text-info",
};

/** Compact pill badge for status and mode labels. */
export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  const cls = [
    "inline-flex items-center rounded-full px-sm py-0.5 text-card-meta font-semibold uppercase tracking-wide",
    toneClass[tone],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={cls} {...rest} />;
}
