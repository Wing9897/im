import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../../components/ui";
import type { TaskActivitySpan } from "../../../types/analysis";
import { formatOsDateTime } from "../../../utils/time";
import { truncateLabel } from "../gantt/ganttEventPositioning";
import { timelinePanelClass } from "../timelineViewLayout";

type TaskDetailPanelProps = {
  span: TaskActivitySpan;
  onClose: () => void;
};

/**
 * Detail panel displayed when a user clicks a Task_Bar in the Gantt view.
 */
export function TaskDetailPanel({ span, onClose }: TaskDetailPanelProps) {
  const { t } = useTranslation("timeline");
  const description = span.description
    ? truncateLabel(span.description, 200)
    : null;

  const formattedRange = formatGanttAnalysisRange(span.analysisTimeRange);

  return (
    <div className={`${timelinePanelClass} relative`}>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("taskDetail.closeAria")}
        className="absolute right-md top-md flex min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent p-xs text-text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary"
      >
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>

      <div className="flex flex-col gap-[10px]">
        <div className="break-words pr-7 text-section-title font-bold text-text-primary">
          {span.taskName}
        </div>

        {description && (
          <div className="text-body leading-relaxed text-text-secondary">
            {description}
          </div>
        )}

        <div className="text-body text-text-secondary">
          {t("taskDetail.analysisRange", { range: formattedRange })}
        </div>

        <div>
          <Badge tone={span.isActive ? "success" : "neutral"}>
            {span.isActive ? t("taskDetail.active") : t("taskDetail.inactive")}
          </Badge>
        </div>

        <div className="text-body text-text-secondary">
          {t("taskDetail.completedBatches", { count: span.completedBatchCount })}
        </div>
      </div>
    </div>
  );
}

function formatGanttAnalysisRange(range: string): string {
  if (range.includes("/")) {
    const [start, end] = range.split("/");
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      return `${formatOsDateTime(start)} – ${formatOsDateTime(end)}`;
    }
  }
  return range;
}
