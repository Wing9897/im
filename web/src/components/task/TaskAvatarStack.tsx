import { TaskEmployeeAvatar } from "./TaskEmployeeAvatar";
import { TaskLogoMark, TASK_LOGO_MARK_PX } from "./TaskLogoMark";
import type { TaskEmployeeId } from "../../domain/tasks/taskEmployee";

const BADGE_OFFSET_PX = 6;
const STACK_PX = TASK_LOGO_MARK_PX + BADGE_OFFSET_PX;

type Props = {
  emoji: string;
  employeeId: TaskEmployeeId;
  employeeName?: string;
  className?: string;
};

/**
 * Two-avatar task identity:
 * - large: default task logo, or user emoji
 * - small: AI / LLM staff head, badge overlay bottom-right (not replaced by emoji)
 */
export function TaskAvatarStack({
  emoji,
  employeeId,
  employeeName,
  className = "",
}: Props) {
  return (
    <span
      className={["relative inline-block shrink-0", className].filter(Boolean).join(" ")}
      style={{ width: STACK_PX, height: STACK_PX }}
      data-testid="task-avatar-stack"
    >
      <span className="absolute left-0 top-0">
        <TaskLogoMark emoji={emoji} />
      </span>
      <span
        className={[
          "absolute bottom-0 right-0 overflow-hidden rounded-full",
          "bg-[var(--surface-card)]",
          "ring-1 ring-[color-mix(in_srgb,var(--surface-raised)_85%,var(--text-primary))]",
        ].join(" ")}
        data-testid="task-avatar-ai-badge"
      >
        <TaskEmployeeAvatar employeeId={employeeId} size="badge" label={employeeName} />
      </span>
    </span>
  );
}
