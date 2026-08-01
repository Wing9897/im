import { useTranslation } from "react-i18next";
import { FieldLabel, SelectField, TextField } from "../../components/ui";
import { untilToDateInput } from "./recurrenceRuleUtils";
import type { RecurrenceEnd, RecurrenceEndType } from "../../types/calendar";

const END_VALUES: RecurrenceEndType[] = ["never", "until", "count"];

interface UntilCountSelectorProps {
  end: RecurrenceEnd;
  onEndTypeChange: (type: RecurrenceEndType) => void;
  onUntilChange: (date: string) => void;
  onCountChange: (value: string) => void;
  disabled?: boolean;
  onUntilFocus?: () => void;
  onUntilBlur?: () => void;
  onCountFocus?: () => void;
  onCountBlur?: () => void;
}

export function UntilCountSelector({
  end,
  onEndTypeChange,
  onUntilChange,
  onCountChange,
  disabled,
  onUntilFocus,
  onUntilBlur,
  onCountFocus,
  onCountBlur,
}: UntilCountSelectorProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="min-w-[200px] flex-1">
        <FieldLabel htmlFor="recurrence-end-type">{t("tasks.recurrence.endLabel")}</FieldLabel>
        <SelectField
          id="recurrence-end-type"
          value={end.type}
          onChange={(e) => onEndTypeChange(e.target.value as RecurrenceEndType)}
          disabled={disabled}
          aria-label={t("tasks.recurrence.endLabel")}
        >
          {END_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`tasks.recurrence.${value}`)}
            </option>
          ))}
        </SelectField>
      </div>

      {end.type === "until" && (
        <div className="min-w-[200px] flex-1">
          <FieldLabel htmlFor="recurrence-until">{t("tasks.recurrence.untilDate")}</FieldLabel>
          <TextField
            id="recurrence-until"
            type="date"
            value={untilToDateInput(end.until)}
            onChange={(e) => onUntilChange(e.target.value)}
            onFocus={onUntilFocus}
            onBlur={onUntilBlur}
            disabled={disabled}
            aria-label={t("tasks.recurrence.untilDate")}
          />
        </div>
      )}

      {end.type === "count" && (
        <div className="min-w-[200px] flex-1">
          <FieldLabel htmlFor="recurrence-count">{t("tasks.recurrence.countLabel")}</FieldLabel>
          <TextField
            id="recurrence-count"
            type="number"
            min={1}
            max={9999}
            step={1}
            value={end.count ?? 1}
            onChange={(e) => onCountChange(e.target.value)}
            onFocus={onCountFocus}
            onBlur={onCountBlur}
            disabled={disabled}
            aria-label={t("tasks.recurrence.countLabel")}
          />
        </div>
      )}
    </>
  );
}
