import type { CSSProperties } from "react";
import { Repeat } from "lucide-react";
import { AiStaffAvatar } from "../aiStaff/AiStaffAvatar";
import {
  aiStaffIdForTaskEmployee,
  type TaskEmployeeId,
} from "../../domain/tasks/taskEmployee";

const SIZE_PX = {
  xs: 22,
  sm: 28,
  md: 36,
} as const;

type TaskEmployeeAvatarProps = {
  employeeId: TaskEmployeeId;
  size?: keyof typeof SIZE_PX;
  label?: string;
  className?: string;
  /**
   * When false (default), recurring renders nothing (list / TaskCard badges).
   * When true, recurring shows a Lucide Repeat glyph for task-type picker cards.
   */
  showRecurringIcon?: boolean;
};

/** AI staff avatar for AI task types; optional Repeat icon for recurring picker cards. */
export function TaskEmployeeAvatar({
  employeeId,
  size = "md",
  label,
  className = "",
  showRecurringIcon = false,
}: TaskEmployeeAvatarProps) {
  const aiStaffId = aiStaffIdForTaskEmployee(employeeId);
  if (aiStaffId) {
    return (
      <AiStaffAvatar
        staffId={aiStaffId}
        size={size}
        label={label}
        className={className}
      />
    );
  }

  if (!showRecurringIcon) return null;

  const px = SIZE_PX[size];
  const style = { width: px, height: px } as CSSProperties;
  const iconSize = Math.max(14, Math.round(px * 0.62));

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface-card))] text-accent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="task-type-icon-recurring"
    >
      <Repeat size={iconSize} strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}
