import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Readable icon-chip grid: ~7.5rem min track so labels (e.g. "MacBook Pro")
 * stay legible; wraps instead of crushing in a narrow sidebar column.
 */
export const ITEM_FORM_CHIP_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(8rem,max-content))] items-start justify-items-start gap-x-sm gap-y-sm";

export const ITEM_FORM_CHIP_LABEL_CLASS =
  "block max-w-full truncate text-center text-caption font-medium text-text-primary";

/** Secondary caption under chips (dates / keys) — muted vs primary title. */
export const ITEM_FORM_CHIP_KEY_CLASS =
  "block max-w-full truncate text-center text-card-meta text-text-muted";

/** Shared chip shell width — wide enough before truncate kicks in. */
export const ITEM_FORM_CHIP_SHELL_CLASS =
  "flex w-auto min-w-[8rem] max-w-[11.5rem] flex-col items-center p-0.5";

const ICON_CIRCLE_BASE =
  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors";

const ICON_CIRCLE_SOLID = `${ICON_CIRCLE_BASE} border-surface-border/60 bg-surface-raised text-text-secondary`;

const ICON_CIRCLE_EXPIRY =
  `${ICON_CIRCLE_BASE} border-[color-mix(in_srgb,var(--warning)_42%,transparent)] ` +
  "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-warning";

type IconChipProps = {
  icon: ReactNode;
  label: string;
  title?: string;
  sublabel?: string;
  /** Rendered below the label row — never absolutely stacked on the circle. */
  badge?: ReactNode;
  variant?: "default" | "expiry";
  disabled?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  /** Optional dismiss control (trash/X); does not trigger onClick. */
  onDelete?: () => void;
  deleteAriaLabel?: string;
  deleteTestId?: string;
  testId?: string;
  labelTestId?: string;
  kindTestId?: string;
};

/** CV-style chip: solid circle icon on top, truncated label below. */
export function ItemFormIconChip({
  icon,
  label,
  title,
  sublabel,
  badge,
  variant = "default",
  disabled = false,
  interactive = false,
  onClick,
  onDelete,
  deleteAriaLabel,
  deleteTestId,
  testId,
  labelTestId,
  kindTestId,
}: IconChipProps) {
  const clickable = interactive && Boolean(onClick) && !disabled;

  const activate = () => {
    if (!clickable) return;
    onClick?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  const onDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onDelete?.();
  };

  const circleClass = variant === "expiry" ? ICON_CIRCLE_EXPIRY : ICON_CIRCLE_SOLID;

  const body = (
    <>
      <span className={`${circleClass} mx-auto`}>{icon}</span>
      <span
        className={`mt-0.5 w-full min-w-0 ${ITEM_FORM_CHIP_LABEL_CLASS}`}
        title={title ?? label}
        data-testid={labelTestId}
      >
        {label}
      </span>
      {sublabel ? (
        <span className={`mt-0 block max-w-full truncate text-center ${ITEM_FORM_CHIP_KEY_CLASS}`}>
          {sublabel}
        </span>
      ) : null}
      {badge ? (
        <span className="mt-1 flex w-full min-w-0 justify-center">{badge}</span>
      ) : null}
      {kindTestId ? (
        <span className="sr-only" data-testid={kindTestId} />
      ) : null}
    </>
  );

  const deleteBtn =
    onDelete != null ? (
      <button
        type="button"
        className="absolute -right-0.5 -top-0.5 z-10 border-0 bg-transparent p-0.5 text-text-muted shadow-none outline-none ring-0 hover:text-error focus-visible:text-error disabled:opacity-50"
        disabled={disabled}
        aria-label={deleteAriaLabel ?? label}
        data-testid={deleteTestId}
        onClick={onDeleteClick}
      >
        <X size={14} strokeWidth={2} aria-hidden />
      </button>
    ) : null;

  if (clickable) {
    return (
      <div className="relative">
        {deleteBtn}
        <button
          type="button"
          className={`${ITEM_FORM_CHIP_SHELL_CLASS} rounded-md border-0 bg-transparent text-left hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={disabled}
          data-testid={testId}
          onClick={activate}
          onKeyDown={onKeyDown}
        >
          {body}
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${ITEM_FORM_CHIP_SHELL_CLASS}`} data-testid={testId}>
      {deleteBtn}
      {body}
    </div>
  );
}
