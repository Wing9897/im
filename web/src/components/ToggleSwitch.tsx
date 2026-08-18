import React, { type ReactNode } from "react";
import { SwitchTrack } from "./ui/SwitchTrack";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (newValue: boolean) => void;
  disabled?: boolean;
  /** Accessible name (always applied to the switch). */
  label: string;
  /** Override aria-label when the visible label should stay shorter. */
  ariaLabel?: string;
  /** Native tooltip; defaults to aria/label when the visible text label is hidden. */
  title?: string;
  /** Visual mark shown before the track (e.g. flowchart gate icons). */
  icon?: ReactNode;
  /** When false, only the track is shown (label stays on aria-label). Default true. */
  showLabel?: boolean;
  "data-testid"?: string;
}

export const ToggleSwitch = React.memo(function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  ariaLabel,
  title,
  icon,
  showLabel = true,
  "data-testid": dataTestId,
}: ToggleSwitchProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(!checked);
    }
  };

  const accessibleName = ariaLabel ?? label;
  const tooltip = title ?? (icon && !showLabel ? accessibleName : undefined);

  return (
    <div
      className={[
        "inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
        icon ? "gap-xs" : showLabel ? "gap-md" : "",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="switch"
      aria-checked={checked}
      aria-label={accessibleName}
      title={tooltip}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      data-testid={dataTestId}
    >
      {icon}
      <SwitchTrack checked={checked} disabled={disabled} />
      {showLabel ? (
        <span className="select-none text-body text-text-primary">{label}</span>
      ) : null}
    </div>
  );
});
