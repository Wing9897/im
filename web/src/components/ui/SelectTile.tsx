import type { ReactNode } from "react";
import { SwitchTrack } from "./SwitchTrack";

export type SelectTileVariant = "select" | "toggle";

interface SelectTileProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  hint?: string;
  className?: string;
  /** Compact density for settings forms (matches field label scale). */
  compact?: boolean;
  disabled?: boolean;
  title?: string;
  /**
   * `select` = mutually exclusive 框選 (aria-pressed).
   * `toggle` = independent on/off with a visible switch (aria-checked).
   */
  variant?: SelectTileVariant;
  "aria-pressed"?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
}

const tileBase =
  "im-surface-inset box-border min-h-8 cursor-pointer rounded-md border border-surface-border text-left font-medium text-text-primary shadow-sm transition-[border-color,background,box-shadow,outline-color] duration-200 ease-[var(--im-easing-out)] hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--surface-border))] hover:!transform-none active:!transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color-mix(in_srgb,var(--accent)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-surface-border";

/** Selected: inset outline (outer box size unchanged) + tint. No font-weight swap. */
const tileSelectActive =
  "border-accent bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-panel))] text-accent outline outline-2 -outline-offset-2 outline-accent";

/** On: accent tint + switch. Off: muted, no accent frame. */
const tileToggleOn =
  "border-accent bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface-panel))] text-text-primary shadow-md";
const tileToggleOff = "text-text-secondary";

/** Single selectable tile card (provider, action type, etc.). */
export function SelectTile({
  active = false,
  onClick,
  children,
  hint,
  className,
  compact = false,
  disabled = false,
  title,
  variant = "select",
  "aria-pressed": ariaPressed,
  "aria-label": ariaLabel,
  "data-testid": dataTestId,
}: SelectTileProps) {
  const isToggle = variant === "toggle";
  const cls = [
    tileBase,
    compact ? "p-sm text-caption" : "p-md text-body",
    isToggle ? (active ? tileToggleOn : tileToggleOff) : active ? tileSelectActive : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const hintEl = hint ? (
    <span className="mt-0.5 block text-caption font-normal text-text-muted">{hint}</span>
  ) : null;

  return (
    <button
      type="button"
      className={cls}
      title={title}
      aria-label={ariaLabel}
      role={isToggle ? "switch" : undefined}
      aria-checked={isToggle ? active : undefined}
      aria-pressed={isToggle ? undefined : (ariaPressed ?? active)}
      data-testid={dataTestId}
      disabled={disabled}
      onClick={onClick}
    >
      {isToggle ? (
        <span className="flex w-full items-start justify-between gap-sm">
          <span className="min-w-0 flex-1">
            {children}
            {hintEl}
          </span>
          <SwitchTrack checked={active} size={compact ? "sm" : "md"} disabled={disabled} />
        </span>
      ) : (
        <>
          {children}
          {hintEl}
        </>
      )}
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
