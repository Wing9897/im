import { useTranslation } from "react-i18next";
import { FieldLabel, SelectField, TextField } from "../../components/ui";
import type { RecurrenceFreq } from "../../types/calendar";

const FREQ_VALUES: RecurrenceFreq[] = ["daily", "weekly", "monthly", "yearly"];

interface FrequencySelectorProps {
  freq: RecurrenceFreq;
  interval: number;
  onFreqChange: (freq: RecurrenceFreq) => void;
  onIntervalChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
}

export function FrequencySelector({
  freq,
  interval,
  onFreqChange,
  onIntervalChange,
  onFocus,
  onBlur,
  disabled,
}: FrequencySelectorProps) {
  const { t } = useTranslation();
  const unit = t(`tasks.recurrence.intervalUnit.${freq}`);

  return (
    <>
      <div className="min-w-[160px] flex-1">
        <FieldLabel htmlFor="recurrence-freq">{t("tasks.recurrence.freqLabel")}</FieldLabel>
        <SelectField
          id="recurrence-freq"
          value={freq}
          onChange={(e) => onFreqChange(e.target.value as RecurrenceFreq)}
          disabled={disabled}
          aria-label={t("tasks.recurrence.freqLabel")}
        >
          {FREQ_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`tasks.recurrence.${value}`)}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="min-w-[160px] flex-1">
        <FieldLabel htmlFor="recurrence-interval">
          {t("tasks.recurrence.intervalLabel", { unit })}
        </FieldLabel>
        <TextField
          id="recurrence-interval"
          type="number"
          min={1}
          max={999}
          step={1}
          value={interval}
          onChange={(e) => onIntervalChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={disabled}
          aria-label={t("tasks.recurrence.intervalAria")}
        />
      </div>
    </>
  );
}
