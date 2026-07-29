import type { AiStaffId } from "../../domain/aiStaff/aiStaff";
import { TASKS_CONSULT_ADVISOR_TOOL } from "../../domain/tasks/taskEditorDraftBridge";

/** Maps agent tool names to an AI-staff identity for caption attribution. */
export function staffIdForAgentTool(toolName: string): AiStaffId | null {
  if (toolName === TASKS_CONSULT_ADVISOR_TOOL) return "taskEditor";
  return null;
}
