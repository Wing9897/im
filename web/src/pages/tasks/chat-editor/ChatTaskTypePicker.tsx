import { FieldLabel, SelectTile, SelectTileGrid } from "../../../components/ui";
import {
  getTaskEmployeeBlurb,
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
  taskFormAnalysisModeOrder,
} from "../../../components/task/taskFormAnalysisModeMeta";
import { TaskEmployeeAvatar } from "../../../components/task/TaskEmployeeAvatar";
import { analysisModeForTaskEmployee } from "../../../domain/tasks/taskEmployee";
import type { AnalysisMode } from "../../../types";

interface ChatTaskTypePickerProps {
  analysisMode: AnalysisMode;
  requiredTitle: string;
  taskTypeLabel: string;
  onAnalysisModeChange: (value: AnalysisMode) => void;
}

export function ChatTaskTypePicker({
  analysisMode,
  requiredTitle,
  taskTypeLabel,
  onAnalysisModeChange,
}: ChatTaskTypePickerProps) {
  return (
    <div
      className="flex flex-col gap-sm md:col-span-2"
      role="group"
      aria-label={taskTypeLabel}
      aria-required
      data-testid="task-employee-picker"
    >
      <FieldLabel required requiredTitle={requiredTitle} className="mb-0">
        {taskTypeLabel}
      </FieldLabel>
      <SelectTileGrid
        columns="repeat(auto-fit, minmax(148px, 1fr))"
        className="gap-sm"
      >
        {taskFormAnalysisModeOrder.map((mode) => {
          const employeeId = getTaskEmployeeIdForMode(mode);
          const nameLabel = getTaskEmployeeDisplayName(employeeId);
          const blurb = getTaskEmployeeBlurb(employeeId);
          const selected = analysisMode === mode;
          return (
            <SelectTile
              key={mode}
              compact
              active={selected}
              aria-pressed={selected}
              onClick={() =>
                onAnalysisModeChange(analysisModeForTaskEmployee(employeeId))
              }
              hint={blurb}
              className="min-h-0"
            >
              <span className="flex items-center gap-sm">
                <TaskEmployeeAvatar
                  employeeId={employeeId}
                  size="sm"
                  label={nameLabel}
                />
                <span className="leading-snug">{nameLabel}</span>
              </span>
            </SelectTile>
          );
        })}
      </SelectTileGrid>
    </div>
  );
}
