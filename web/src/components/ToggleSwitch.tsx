import React from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (newValue: boolean) => void;
  disabled?: boolean;
  /** Accessible name (always applied to the switch). */
  label: string;
  /** When false, only the track is shown (label stays on aria-label). Default true. */
  showLabel?: boolean;
}

export const ToggleSwitch = React.memo(function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  showLabel = true,
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
    >
      <div
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-accent" : "bg-surface-border",
          disabled ? "opacity-60" : "",
        ].join(" ")}
      >
        <div
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-[var(--text-on-accent,var(--surface-base))] shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left] duration-150",
            checked ? "left-[22px]" : "left-0.5",
          ].join(" ")}
        />
      </div>
      {showLabel ? (
        <span className="select-none text-body text-text-primary">{label}</span>
      ) : null}
    </div>
  );
});
