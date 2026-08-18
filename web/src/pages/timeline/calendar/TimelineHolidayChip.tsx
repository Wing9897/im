import { useTranslation } from "react-i18next";

import type { DailyHoliday } from "../../../hooks/useMonthHolidays";
import { holidayNamesForDay } from "../../../hooks/useMonthHolidays";

type TimelineHolidayChipProps = {
  day: Date;
  holidaysByDate: Record<string, DailyHoliday[]>;
  testId?: string;
};

/** Read-only public-holiday label for day / week calendar headers. Month cells use a watermark instead. */
export function TimelineHolidayChip({
  day,
  holidaysByDate,
  testId = "timeline-holiday-chip",
}: TimelineHolidayChipProps) {
  const { t } = useTranslation("timeline");
  const names = holidayNamesForDay(day, holidaysByDate);
  if (names.length === 0) return null;
  const joined = names.join(t("calendar.holidayNameSep"));
  return (
    <span
      className="im-holiday-chip inline-flex max-w-full shrink-0 items-center text-[10px] leading-none"
      aria-label={t("calendar.holidayAria", { name: joined })}
      title={t("calendar.holidayTitle", { name: joined })}
      data-testid={testId}
    >
      {joined}
    </span>
  );
}
