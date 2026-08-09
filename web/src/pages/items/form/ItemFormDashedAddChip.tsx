import type { KeyboardEvent, ReactNode } from "react";

import {
  ITEM_FORM_CHIP_LABEL_CLASS,
  ITEM_FORM_CHIP_SHELL_CLASS,
} from "./ItemFormIconChip";

const DASHED_CIRCLE_BASE =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed transition-colors";

const DASHED_CIRCLE_DEFAULT =
  `${DASHED_CIRCLE_BASE} border-surface-border/55 text-text-muted ` +
  "hover:border-surface-border hover:text-text-secondary";

const DASHED_CIRCLE_EXPIRY =
  `${DASHED_CIRCLE_BASE} border-[color-mix(in_srgb,var(--warning)_40%,transparent)] text-warning ` +
  "hover:border-[color-mix(in_srgb,var(--warning)_58%,transparent)]";

type Props = {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  variant?: "default" | "expiry";
  /** `chip` = icon column; `field` = full-width cell matching attribute field grid. */
  layout?: "chip" | "field";
  onClick: () => void;
  testId?: string;
  ariaLabel?: string;
};

/** Dashed circle + label — used for add linked calendar / add attribute. */
export function ItemFormDashedAddChip({
  icon,
  label,
  disabled = false,
  variant = "default",
  layout = "chip",
  onClick,
  testId,
  ariaLabel,
}: Props) {
  const circleClass = variant === "expiry" ? DASHED_CIRCLE_EXPIRY : DASHED_CIRCLE_DEFAULT;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  const shellClass =
    layout === "field"
      ? "flex min-h-[3.25rem] w-full min-w-0 flex-row items-center justify-center gap-xs rounded-md border border-dashed border-surface-border/55 bg-transparent px-sm py-1.5 text-text-muted hover:border-surface-border hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
      : `${ITEM_FORM_CHIP_SHELL_CLASS} rounded-md border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-50`;

  return (
    <button
      type="button"
      className={shellClass}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      data-testid={testId}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
      onKeyDown={onKeyDown}
    >
      {layout === "field" ? (
        <>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-current">
            {icon}
          </span>
          <span className="min-w-0 truncate text-caption font-medium" title={label}>
            {label}
          </span>
        </>
      ) : (
        <>
          <span className={`${circleClass} mx-auto`}>{icon}</span>
          <span
            className={`mt-0.5 w-full min-w-0 ${ITEM_FORM_CHIP_LABEL_CLASS}`}
            title={label}
          >
            {label}
          </span>
        </>
      )}
    </button>
  );
}
