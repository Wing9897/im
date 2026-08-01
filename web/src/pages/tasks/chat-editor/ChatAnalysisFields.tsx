/**
 * Analysis fields sub-component for the ChatEditorForm.
 */

import { useTranslation } from "react-i18next";
import { FieldLabel, FilterChip } from "../../../components/ui";
import type { AnalysisTimeRange } from "../../../types";

/** Chip option values for the analysis time range field. */
export const TIME_RANGE_VALUES = ["all", "30d", "7d", "1d"] as const;

const TIME_RANGE_LABEL_KEYS: Record<(typeof TIME_RANGE_VALUES)[number], string> = {
  all: "tasks.editor.timeAll",
  "30d": "tasks.editor.time30d",
  "7d": "tasks.editor.time7d",
  "1d": "tasks.editor.time1d",
};

interface ChatAnalysisFieldsProps {
  analysisTimeRange: AnalysisTimeRange;
  onAnalysisTimeRangeChange: (value: AnalysisTimeRange) => void;
}

export function ChatAnalysisFields({
  analysisTimeRange,
  onAnalysisTimeRangeChange,
}: ChatAnalysisFieldsProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-w-0 flex-col gap-sm">
      <FieldLabel id="analysis-time-range-label">{t("tasks.editor.timeRangeLabel")}</FieldLabel>
      <div
        className="flex min-w-0 flex-wrap gap-sm"
        role="group"
        aria-labelledby="analysis-time-range-label"
      >
        {TIME_RANGE_VALUES.map((value) => {
          const label = t(TIME_RANGE_LABEL_KEYS[value]);
          return (
            <FilterChip
              key={value}
              size="sm"
              active={analysisTimeRange === value}
              onClick={() => onAnalysisTimeRangeChange(value)}
              aria-label={label}
            >
              {label}
            </FilterChip>
          );
        })}
      </div>
    </div>
  );
}
