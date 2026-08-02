import type { CSSProperties } from "react";
import { AiStaffAvatar } from "../aiStaff/AiStaffAvatar";
import {
  aiStaffIdForTaskEmployee,
  type TaskEmployeeId,
} from "../../domain/tasks/taskEmployee";
import scheduleClerkSrc from "../../assets/ai-staff/scheduleClerk.png";

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
};

/** Consistent employee logo for L2 picker / task cards (AI staff or schedule clerk). */
export function TaskEmployeeAvatar({
  employeeId,
  size = "md",
  label,
  className = "",
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

  const px = SIZE_PX[size];
  const style = { width: px, height: px } as CSSProperties;

  return (
    <span
      className={[
        "im-ai-staff-avatar inline-flex shrink-0 overflow-hidden rounded-full bg-transparent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="task-employee-avatar-scheduleClerk"
    >
      <img
        src={scheduleClerkSrc}
        alt=""
        width={px}
        height={px}
        className="pointer-events-none h-full w-full border-0 object-cover"
        draggable={false}
      />
    </span>
  );
}
