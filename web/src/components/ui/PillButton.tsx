import { forwardRef, type ButtonHTMLAttributes } from "react";

type PillPadding = "default" | "square";

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** `square` adds matching vertical padding for icon-only chrome. */
  padding?: PillPadding;
}

const paddingClass: Record<PillPadding, string> = {
  default: "px-sm",
  square: "px-sm py-sm",
};

/** Compact pill toggle — active/inactive states for filters and scale controls. */
export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  function PillButton(
    { active = false, padding = "default", className, type = "button", ...rest },
    ref,
  ) {
    const cls = [
      "inline-flex min-h-7 cursor-pointer items-center justify-center rounded-md border text-caption font-medium transition-[background,color,border-color,box-shadow] duration-150 ease-out hover:!transform-none active:!transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
      paddingClass[padding],
      active
        ? "border-accent bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent"
        : "border-surface-border bg-transparent text-text-secondary hover:border-[color-mix(in_srgb,var(--text-muted)_35%,var(--surface-border))] hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    return <button ref={ref} type={type} className={cls} {...rest} />;
  },
);
