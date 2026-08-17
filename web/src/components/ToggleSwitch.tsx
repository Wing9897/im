import React from "react";
import { SwitchTrack } from "./ui/SwitchTrack";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (newValue: boolean) => void;
  disabled?: boolean;
  /** Accessible name (always applied to the switch). */
  label: string;
  /** When false, only the track is shown (label stays on aria-label). Default true. */
  showLabel?: boolean;
  "data-testid"?: string;
}

export const ToggleSwitch = React.memo(function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
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

  return (
    <div
      className={[
        "inline-flex items-center gap-md rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      data-testid={dataTestId}
    >
      <SwitchTrack checked={checked} disabled={disabled} />
      {showLabel ? (
        <span className="select-none text-body text-text-primary">{label}</span>
      ) : null}
    </div>
  );
});
