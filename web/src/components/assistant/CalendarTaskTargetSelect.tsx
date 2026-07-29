import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { SelectField } from "../ui";
import {
  USER_EVENTS_FILTER_ID,
  filterAssignableTimelineTasks,
  isUnassignedUserEventTaskId,
  toUserEventFormTaskId,
} from "../../domain/timeline/userEvents";
import { useUserEventsFilterLabel } from "../../domain/timeline/useUserEventsFilterLabel";

export type CalendarTaskTargetOption = {
  id: string;
  name: string;
};

/**
 * Presentational target-task picker (``__user__`` + provided options).
 * When ``keepStaleOption`` is set, values missing from options stay selectable.
 */
export function CalendarTaskTargetSelectField({
  id,
  value,
  onChange,
  options,
  disabled,
  className,
  keepStaleOption = false,
  "data-testid": testId = "calendar-task-target",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (taskId: string) => void;
  options: readonly CalendarTaskTargetOption[];
  disabled?: boolean;
  className?: string;
  keepStaleOption?: boolean;
  "data-testid"?: string;
  "aria-label"?: string;
}) {
  const { t } = useTranslation(["assistant", "timeline"]);
  const userEventsLabel = useUserEventsFilterLabel();
  const normalized = toUserEventFormTaskId(value);
  const inOptions = options.some((opt) => opt.id === normalized);
  const unassigned = isUnassignedUserEventTaskId(normalized);
  const selectValue =
    keepStaleOption || unassigned || inOptions ? normalized : USER_EVENTS_FILTER_ID;
  const showStale = keepStaleOption && !unassigned && !inOptions;

  return (
    <SelectField
      id={id}
      value={selectValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
      data-testid={testId}
      aria-label={ariaLabel ?? t("assistant:targetTask.aria")}
    >
      <option value={USER_EVENTS_FILTER_ID}>{userEventsLabel}</option>
      {showStale ? (
        <option value={normalized}>{normalized}</option>
      ) : null}
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.name}
        </option>
      ))}
    </SelectField>
  );
}

/**
 * Target-task picker for assistant create defaults (``__user__`` + event/recurring/calendar_task).
 */
export function CalendarTaskTargetSelect({
  id,
  value,
  onChange,
  disabled,
  className,
  "data-testid": testId = "calendar-task-target",
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (taskId: string) => void;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
  "aria-label"?: string;
}) {
  const { tasks } = useTaskCatalog();
  const taskOptions = useMemo<CalendarTaskTargetOption[]>(
    () =>
      filterAssignableTimelineTasks(tasks, { activeOnly: true }).map((task) => ({
        id: task.id,
        name: task.name,
      })),
    [tasks],
  );

  return (
    <CalendarTaskTargetSelectField
      id={id}
      value={value}
      onChange={onChange}
      options={taskOptions}
      disabled={disabled}
      className={className}
      data-testid={testId}
      aria-label={ariaLabel}
    />
  );
}
