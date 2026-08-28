import { CalendarDays, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PillButton } from "../../components/ui";

export type GanttViewMode = "day" | "month";

interface GanttViewModeControlsProps {
  viewMode: GanttViewMode;
  onChange: (mode: GanttViewMode) => void;
  /** Aria label prefix, e.g. Gantt by task / by event. */
  ariaLabelPrefix: string;
  /** Test id prefix, e.g. "board-gantt" or "board-gantt-events". */
  testIdPrefix: string;
}

/** Shared day/month icon toggle for board gantt widget headers. */
export function GanttViewModeControls({
  viewMode,
  onChange,
  ariaLabelPrefix,
  testIdPrefix,
}: GanttViewModeControlsProps) {
  const { t } = useTranslation();
  const dayLabel = t("board:common.dayView");
  const monthLabel = t("board:common.monthView");

  return (
    <>
      <PillButton
        padding="square"
        active={viewMode === "day"}
        className="board-widget-frame__btn"
        title={dayLabel}
        aria-label={t("board:common.viewModeAria", { prefix: ariaLabelPrefix, mode: dayLabel })}
        aria-pressed={viewMode === "day"}
        data-testid={`${testIdPrefix}-view-day`}
        onClick={() => onChange("day")}
      >
        <Clock3 size={12} strokeWidth={2} aria-hidden="true" />
      </PillButton>
      <PillButton
        padding="square"
        active={viewMode === "month"}
        className="board-widget-frame__btn"
        title={monthLabel}
        aria-label={t("board:common.viewModeAria", { prefix: ariaLabelPrefix, mode: monthLabel })}
        aria-pressed={viewMode === "month"}
        data-testid={`${testIdPrefix}-view-month`}
        onClick={() => onChange("month")}
      >
        <CalendarDays size={12} strokeWidth={2} aria-hidden="true" />
      </PillButton>
    </>
  );
}
