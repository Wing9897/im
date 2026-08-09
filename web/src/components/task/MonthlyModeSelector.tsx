import { useTranslation } from "react-i18next";
import { FieldLabel, FilterChip, SelectField } from "../../components/ui";
import { WEEKDAY_CODES } from "../../utils/rrule";
import type { WeekdayCode } from "../../types/calendar";
import type { MonthlyMode } from "../../domain/tasks/recurrenceRuleUtils";

const ORDINAL_VALUES = [1, 2, 3, 4, -1] as const;

interface MonthlyModeSelectorProps {
  monthlyMode: MonthlyMode;
  byMonthDay: number[];
  ordinal: number | null;
  ordinalWeekday: WeekdayCode;
  onSetMode: (mode: MonthlyMode) => void;
  onToggleMonthDay: (day: number) => void;
  onOrdinalChange: (value: string) => void;
  onOrdinalWeekday: (day: WeekdayCode) => void;
  disabled?: boolean;
}

export function MonthlyModeSelector({
  monthlyMode,
  byMonthDay,
  ordinal,
  ordinalWeekday,
  onSetMode,
  onToggleMonthDay,
  onOrdinalChange,
  onOrdinalWeekday,
  disabled,
}: MonthlyModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-md">
      <div>
        <FieldLabel>{t("tasks.recurrence.monthlyMode")}</FieldLabel>
        <div className="flex gap-sm">
          <FilterChip
            size="lg"
            active={monthlyMode === "monthday"}
            onClick={() => onSetMode("monthday")}
            disabled={disabled}
          >
            {t("tasks.recurrence.byDate")}
          </FilterChip>
          <FilterChip
            size="lg"
            active={monthlyMode === "weekday"}
            onClick={() => onSetMode("weekday")}
            disabled={disabled}
          >
            {t("tasks.recurrence.byWeekday")}
          </FilterChip>
        </div>
      </div>

      {monthlyMode === "monthday" && (
        <div>
          <FieldLabel>{t("tasks.recurrence.monthDay")}</FieldLabel>
          <div className="grid grid-cols-7 gap-xs">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const active = byMonthDay.includes(day);
              return (
                <FilterChip
                  key={day}
                  size="sm"
                  active={active}
                  aria-label={t("tasks.recurrence.dayAria", { day })}
                  onClick={() => onToggleMonthDay(day)}
                  disabled={disabled}
                  className="min-w-0 px-sm"
                >
                  {day}
                </FilterChip>
              );
            })}
            <FilterChip
              size="sm"
              active={byMonthDay.includes(-1)}
              aria-label={t("tasks.recurrence.lastDay")}
              onClick={() => onToggleMonthDay(-1)}
              disabled={disabled}
              className="col-span-2"
            >
              {t("tasks.recurrence.lastDay")}
            </FilterChip>
          </div>
        </div>
      )}

      {monthlyMode === "weekday" && (
        <div className="flex flex-wrap items-end gap-md">
          <div className="min-w-[160px] flex-1">
            <FieldLabel htmlFor="recurrence-ordinal">{t("tasks.recurrence.ordinalLabel")}</FieldLabel>
            {/* Native select: recurrence editor stays on SelectField for native form density. */}
            <SelectField
              id="recurrence-ordinal"
              value={ordinal ?? 1}
              onChange={(e) => onOrdinalChange(e.target.value)}
              disabled={disabled}
              aria-label={t("tasks.recurrence.ordinalAria")}
            >
              {ORDINAL_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`tasks.recurrence.ordinals.${value}`)}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="min-w-[160px] flex-1">
            <FieldLabel htmlFor="recurrence-ordinal-weekday">
              {t("tasks.recurrence.ordinalWeekday")}
            </FieldLabel>
            <SelectField
              id="recurrence-ordinal-weekday"
              value={ordinalWeekday}
              onChange={(e) => onOrdinalWeekday(e.target.value as WeekdayCode)}
              disabled={disabled}
              aria-label={t("tasks.recurrence.ordinalWeekdayAria")}
            >
              {WEEKDAY_CODES.map((day) => {
                const label = t(`tasks.recurrence.weekday.${day}`);
                return (
                  <option key={day} value={day}>
                    {t("tasks.recurrence.weekdayAria", { day: label })}
                  </option>
                );
              })}
            </SelectField>
          </div>
        </div>
      )}
    </div>
  );
}
