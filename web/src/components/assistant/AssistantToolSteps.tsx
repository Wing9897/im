import { useTranslation } from "react-i18next";
import type { AgentToolCallSummary } from "../../api/agent";
import type { LiveToolStep } from "../../domain/assistant/liveToolStep";
import { AiStaffAvatar } from "../aiStaff/AiStaffAvatar";
import { captionClass } from "../ui";
import { assistantChatBubbleClass } from "../chat/chatBubbleClasses";
import { staffIdForAgentTool } from "./assistantToolStaff";

export type { LiveToolStep };

interface AssistantLiveToolStepsProps {
  steps: readonly LiveToolStep[];
  testId?: string;
  /** When true, omit outer bubble (parent row already provides chrome). */
  bare?: boolean;
  /** Attribute ``tasks.consult_advisor`` steps to the task advisor avatar/name. */
  attributeTaskAdvisor?: boolean;
}

function ToolStepLabel({
  name,
  attributeTaskAdvisor,
}: {
  name: string;
  attributeTaskAdvisor: boolean;
}) {
  const { t } = useTranslation("common");
  const staffId = attributeTaskAdvisor ? staffIdForAgentTool(name) : null;
  if (!staffId) {
    return <span className="font-medium text-text-primary">{name}</span>;
  }
  const staffName = t(`aiStaff.${staffId}`);
  return (
    <span
      className="inline-flex items-center gap-1 font-medium text-text-primary"
      data-testid="assistant-tool-step-staff"
      data-staff-id={staffId}
    >
      <AiStaffAvatar staffId={staffId} size="xs" label={staffName} />
      <span>{staffName}</span>
      <span className="font-normal text-text-muted">· {name}</span>
    </span>
  );
}

/** In-progress tool steps while the agent loop runs (not token streaming). */
export function AssistantLiveToolSteps({
  steps,
  testId,
  bare = false,
  attributeTaskAdvisor = false,
}: AssistantLiveToolStepsProps) {
  const { t } = useTranslation("assistant");

  if (steps.length === 0) {
    return null;
  }

  const body = (
    <>
      <div className={`${captionClass} mb-1 text-text-muted`}>{t("toolStepsLabel")}</div>
      <ul className="list-inside list-disc text-caption text-text-secondary">
        {steps.map((step, index) => (
          <li key={`${step.name}-${index}`}>
            <ToolStepLabel name={step.name} attributeTaskAdvisor={attributeTaskAdvisor} />
            {step.status === "running" ? (
              <span className="text-text-muted"> — {t("toolRunning")}</span>
            ) : step.resultSummary ? (
              <span> — {step.resultSummary}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );

  if (bare) {
    return (
      <div className={assistantChatBubbleClass("full")} data-testid={testId ?? "assistant-live-tool-steps"}>
        {body}
      </div>
    );
  }

  return (
    <div
      className={`mr-auto ${assistantChatBubbleClass(42)}`}
      data-testid={testId ?? "assistant-live-tool-steps"}
    >
      {body}
    </div>
  );
}

/** Wire/UI tool row: session prefs use AssistantToolCallSchema; live chat uses AgentToolCallSummary. */
type ToolSummaryCall = Pick<AgentToolCallSummary, "name"> & {
  resultSummary?: string | null;
};

interface AssistantToolSummaryProps {
  toolCalls: readonly ToolSummaryCall[];
  testId?: string;
  /** Attribute ``tasks.consult_advisor`` steps to the task advisor avatar/name. */
  attributeTaskAdvisor?: boolean;
}

/** Completed tool calls attached to an assistant message. */
export function AssistantToolSummary({
  toolCalls,
  testId,
  attributeTaskAdvisor = false,
}: AssistantToolSummaryProps) {
  const { t } = useTranslation("assistant");

  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-sm border-t border-surface-border pt-sm"
      data-testid={testId ?? "assistant-tool-summary"}
    >
      <div className={`${captionClass} mb-1 text-text-muted`}>{t("toolCallsLabel")}</div>
      <ul className="list-inside list-disc text-caption text-text-secondary">
        {toolCalls.map((call, index) => (
          <li key={`${call.name}-${index}`}>
            <ToolStepLabel name={call.name} attributeTaskAdvisor={attributeTaskAdvisor} />
            {call.resultSummary ? ` — ${call.resultSummary}` : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
