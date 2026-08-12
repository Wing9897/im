import { AiStaffAvatar, AI_STAFF_AVATAR_SIZE_PX } from "../aiStaff/AiStaffAvatar";
import {
  aiStaffIdForTaskEmployee,
  type TaskEmployeeId,
} from "../../domain/tasks/taskEmployee";

type TaskEmployeeAvatarProps = {
  employeeId: TaskEmployeeId;
  size?: keyof typeof AI_STAFF_AVATAR_SIZE_PX;
  label?: string;
  className?: string;
};

/** AI staff avatar for analysis task types (recurring lives under /schedule). */
export function TaskEmployeeAvatar({
  employeeId,
  size = "md",
  label,
  className = "",
}: TaskEmployeeAvatarProps) {
  return (
    <AiStaffAvatar
      staffId={aiStaffIdForTaskEmployee(employeeId)}
      size={size}
      label={label}
      className={className}
    />
  );
}
