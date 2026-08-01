import { LabeledRange } from "./LabeledRange";

type PercentSliderProps = {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
  "data-testid"?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Integer-percent range control (avoids float min/max quirks that make
 * native range thumbs feel stuck on Windows).
 */
export function PercentSlider({
  id,
  value,
  min = 0.15,
  max = 1,
  onChange,
  disabled = false,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: PercentSliderProps) {
  const minPct = Math.round(min * 100);
  const maxPct = Math.round(max * 100);
  const pct = Math.min(maxPct, Math.max(minPct, Math.round(value * 100)));

  return (
    <LabeledRange
      id={id}
      value={pct}
      min={minPct}
      max={maxPct}
      step={1}
      disabled={disabled}
      className={className}
      ariaLabel={ariaLabel}
      data-testid={testId}
      formatDisplay={(v) => `${v}%`}
      ariaValueText={`${pct}%`}
      onChange={(nextPct) => onChange(nextPct / 100)}
    />
  );
}
