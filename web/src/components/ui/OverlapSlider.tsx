import { useTranslation } from "react-i18next";
import { LabeledRange } from "./LabeledRange";

interface OverlapSliderProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  id?: string;
}

/** Event-task batch overlap slider (0–10). Task-owned; not a global AI setting. */
export function OverlapSlider({
  value,
  onChange,
  label,
  ariaLabel,
  id = "overlap-slider",
}: OverlapSliderProps) {
  const { t } = useTranslation("common");
  const numericValue = parseInt(value, 10) || 0;

  return (
    <LabeledRange
      id={id}
      label={label ?? t("tasks:editor.batchOverlapLabel")}
      ariaLabel={ariaLabel ?? t("tasks:editor.batchOverlapAria")}
      value={numericValue}
      min={0}
      max={10}
      step={1}
      onChange={(next) => onChange(String(next))}
      formatDisplay={(v) => String(v)}
    />
  );
}
