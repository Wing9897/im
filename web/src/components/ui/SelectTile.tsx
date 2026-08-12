import type { ReactNode } from "react";

interface SelectTileProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  hint?: string;
  className?: string;
  /** Compact density for settings forms (matches field label scale). */
  compact?: boolean;
  disabled?: boolean;
  "aria-pressed"?: boolean;
}

const tileBase =
  "im-surface-inset min-h-8 cursor-pointer rounded-md border border-surface-border text-left font-medium text-text-primary shadow-sm transition-[border-color,background,box-shadow,transform] duration-200 ease-[var(--im-easing-out)] motion-safe:active:scale-[1.01] hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--surface-border))] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-surface-border disabled:hover:shadow-sm disabled:active:scale-100";

/** Selected: inset accent frame (visible inside overflow scroll) + tint. */
const tileActive =
  "border-accent bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-panel))] font-semibold text-accent shadow-md ring-2 ring-inset ring-accent";

/** Single selectable tile card (provider, action type, etc.). */
export function SelectTile({
  active = false,
  onClick,
  children,
  hint,
  className,
  compact = false,
  disabled = false,
  "aria-pressed": ariaPressed,
}: SelectTileProps) {
  const cls = [
    tileBase,
    compact ? "p-sm text-caption" : "p-md text-body",
    active ? tileActive : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      aria-pressed={ariaPressed ?? active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      {hint ? (
        <span className="mt-0.5 block text-caption font-normal text-text-muted">{hint}</span>
      ) : null}
    </button>
  );
}

interface SelectTileGridProps {
  children: ReactNode;
  columns?: string;
  className?: string;
}

/** Grid wrapper for SelectTile items. */
export function SelectTileGrid({
  children,
  columns = "repeat(auto-fit, minmax(140px, 1fr))",
  className,
}: SelectTileGridProps) {
  const cls = ["grid gap-lg", className ?? ""].filter(Boolean).join(" ");

  return (
    <div className={cls} style={{ gridTemplateColumns: columns }}>
      {children}
    </div>
  );
}
