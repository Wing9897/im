import { useTranslation } from "react-i18next";
import { FieldLabel, FilterChip } from "../../components/ui";
import { WEEKDAY_CODES } from "../../utils/rrule";
import type { WeekdayCode } from "../../types/calendar";

interface WeekdaySelectorProps {
  byDay: WeekdayCode[];
  onToggle: (day: WeekdayCode) => void;
  disabled?: boolean;
}

export function WeekdaySelector({ byDay, onToggle, disabled }: WeekdaySelectorProps) {
  const { t } = useTranslation();

  return (
    <div>
      <FieldLabel>{t("tasks.recurrence.weekdaysLabel")}</FieldLabel>
      <div className="flex flex-wrap gap-sm">
        {WEEKDAY_CODES.map((day) => {
          const active = byDay.includes(day);
          const label = t(`tasks.recurrence.weekday.${day}`);
          return (
            <FilterChip
              key={day}
              size="lg"
              active={active}
              aria-label={t("tasks.recurrence.weekdayAria", { day: label })}
              onClick={() => onToggle(day)}
              disabled={disabled}
            >
              {label}
            </FilterChip>
          );
        })}
      </div>
    </div>
  );
}
