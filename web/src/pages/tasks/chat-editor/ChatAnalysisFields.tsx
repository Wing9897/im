/**
 * Analysis fields sub-component for the ChatEditorForm.
 */

import { useTranslation } from "react-i18next";
import { FieldLabel, FilterChip } from "../../../components/ui";
import {
  TASK_ANALYSIS_TIME_RANGE_CHIP_ORDER,
  TASK_ANALYSIS_TIME_RANGE_I18N_KEYS,
  type TaskAnalysisTimeRange,
} from "../../../domain/tasks/taskAnalysisTimeRange";

/** Chip option values for the analysis time range field (full task DB allowlist). */
export const TIME_RANGE_VALUES = TASK_ANALYSIS_TIME_RANGE_CHIP_ORDER;

interface ChatAnalysisFieldsProps {
  analysisTimeRange: TaskAnalysisTimeRange;
  onAnalysisTimeRangeChange: (value: TaskAnalysisTimeRange) => void;
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
          const label = t(TASK_ANALYSIS_TIME_RANGE_I18N_KEYS[value]);
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
