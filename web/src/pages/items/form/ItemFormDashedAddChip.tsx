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
  onClick: () => void;
  testId?: string;
  ariaLabel?: string;
  /** Optional menu-trigger a11y (e.g. linked-calendar mode picker). */
  ariaHasPopup?: "menu" | "listbox" | "dialog" | boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
};

/** Dashed circle + label — add linked calendar CTA in the item form chip grid. */
export function ItemFormDashedAddChip({
  icon,
  label,
  disabled = false,
  variant = "default",
  onClick,
  testId,
  ariaLabel,
  ariaHasPopup,
  ariaExpanded,
  ariaControls,
}: Props) {
  const circleClass = variant === "expiry" ? DASHED_CIRCLE_EXPIRY : DASHED_CIRCLE_DEFAULT;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <button
      type="button"
      className={`${ITEM_FORM_CHIP_SHELL_CLASS} rounded-md border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      data-testid={testId}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
      onKeyDown={onKeyDown}
    >
      <span className={`${circleClass} mx-auto`}>{icon}</span>
      <span
        className={`mt-0.5 w-full min-w-0 ${ITEM_FORM_CHIP_LABEL_CLASS}`}
        title={label}
      >
        {label}
      </span>
    </button>
  );
}
