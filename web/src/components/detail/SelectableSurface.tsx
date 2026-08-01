import type React from "react";

type SelectableSurfaceVariant = "card" | "row" | "none";

/** Prevents click/keyboard events from activating a parent SelectableSurface. */
export function stopSelectableActivation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

interface SelectableSurfaceProps {
  variant?: SelectableSurfaceVariant;
  onSelect?: () => void;
  selectAriaLabel?: string;
  semanticRole?: React.AriaRole;
  className?: string;
  style?: React.CSSProperties;
  /** Highlights the row/card as the active preview target. */
  isSelected?: boolean;
  /** Muted read/consumed state (Intelligence list). */
  isRead?: boolean;
  /** Non-selectable controls (buttons, toggles) that must not trigger selection. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  tag?: "div" | "article";
  "data-testid"?: string;
}

const variantClass: Record<SelectableSurfaceVariant, string | undefined> = {
  card: "im-card-hover",
  row: "im-data-list-row flex min-h-11 w-full items-center gap-md border-b border-[color-mix(in_srgb,var(--surface-border)_35%,transparent)] px-list-row-x py-list-row-y text-body leading-snug text-text-primary last:border-b-0 hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color-mix(in_srgb,var(--accent)_35%,transparent)] focus-visible:-outline-offset-2",
  none: undefined,
};

export function SelectableSurface({
  variant = "card",
  onSelect,
  selectAriaLabel,
  semanticRole,
  className,
  style,
  isSelected = false,
  isRead = false,
  actions,
  children,
  tag: Tag = "div",
  "data-testid": dataTestId,
}: SelectableSurfaceProps) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!onSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  const interactiveSlot = actions;

  const mergedClassName = [
    variantClass[variant],
    onSelect ? "cursor-pointer" : undefined,
    isSelected
      ? "is-selected bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] shadow-[inset_2px_0_0_0_var(--accent)]"
      : undefined,
    isRead ? "opacity-60" : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
  const interactiveRole = semanticRole ?? (onSelect ? "button" : undefined);

  return (
    <Tag
      className={mergedClassName}
      role={interactiveRole}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? selectAriaLabel : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      style={style}
      data-testid={dataTestId}
      {...(variant === "row" && onSelect ? { "data-no-hover-lift": "" } : {})}
    >
      {children}
      {interactiveSlot ? (
        <div onClick={stopSelectableActivation} onKeyDown={stopSelectableActivation}>
          {interactiveSlot}
        </div>
      ) : null}
    </Tag>
  );
}
