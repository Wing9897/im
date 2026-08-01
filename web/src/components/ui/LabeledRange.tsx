import { FieldLabel } from "./FieldLabel";

type LabeledRangeProps = {
  id?: string;
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatDisplay?: (value: number) => string;
  ariaLabel?: string;
  ariaValueText?: string;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
};

/**
 * Shared labeled range + value readout (overlap counts, percent opacities, etc.).
 */
export function LabeledRange({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatDisplay = (v) => String(v),
  ariaLabel,
  ariaValueText,
  className,
  disabled = false,
  "data-testid": testId,
}: LabeledRangeProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const resolvedAria = ariaLabel ?? label;

  const control = (
    <div className={["flex min-w-0 flex-1 items-center gap-sm", className ?? ""].join(" ")}>
      <input
        id={id}
        data-testid={testId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        aria-label={resolvedAria}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={ariaValueText ?? formatDisplay(clamped)}
        onChange={(e) => onChange(Number(e.target.value))}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        className="h-5 min-w-0 flex-1 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
      />
      <span className="min-w-11 shrink-0 text-right text-caption font-medium tabular-nums text-text-secondary">
        {formatDisplay(clamped)}
      </span>
    </div>
  );

  if (!label) return control;

  return (
    <div>
      {id ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : (
        <span className="text-caption font-medium text-text-secondary">{label}</span>
      )}
      <div className="mt-xs">{control}</div>
    </div>
  );
}
