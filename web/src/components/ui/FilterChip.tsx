import type { ButtonHTMLAttributes } from "react";

type FilterChipSize = "sm" | "md" | "lg";

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: FilterChipSize;
}

const sizeClass: Record<FilterChipSize, string> = {
  sm: "min-h-7 px-2.5 text-caption",
  md: "min-h-7 px-2.5 text-caption",
  lg: "min-h-8 px-md text-xs",
};

/** Rounded filter pill — replaces `.ui-chip` in forms and pickers. */
export function FilterChip({
  active = false,
  size = "md",
  className,
  type = "button",
  ...rest
}: FilterChipProps) {
  const cls = [
    "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border font-medium font-[inherit] whitespace-nowrap transition-[background,color,border-color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
    sizeClass[size],
    active
      ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--surface-border))] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-semibold text-accent shadow-[var(--shadow-sm)]"
      : "border-surface-border bg-transparent text-text-secondary hover:border-surface-overlay hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={cls} aria-pressed={active} {...rest} />;
}
