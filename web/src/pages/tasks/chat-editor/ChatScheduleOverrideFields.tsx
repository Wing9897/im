/**
 * Per-task analysis scheduling: event overlap is task-owned; other batch fields
 * optionally override AI Settings defaults (null = follow global).
 * Agent message-threshold presets show the same overrides when channels are bound.
 */
import { useTranslation } from "react-i18next";
import { AnalysisSchedulingFields,
  optionalNumberToInput,
  parseOptionalPositiveInt,
  type EvidenceStyle,
} from "../../../components/settings/AnalysisSchedulingFields";
import { OverlapSlider } from "../../../components/ui/OverlapSlider";
import { formHelpClass } from "../../../components/ui/pageTypography";
import { taskShowsMessageBatchOverrides } from "../../../domain/tasks/taskFormUtils";
import type { TaskFormState } from "./useChatEditor";

interface ChatScheduleOverrideFieldsProps {
  formState: TaskFormState;
  updateField: <K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) => void;
}

export function ChatScheduleOverrideFields({
  formState,
  updateField,
}: ChatScheduleOverrideFieldsProps) {
  const { t } = useTranslation(["common", "settings"]);
  const showBatchOverrides = taskShowsMessageBatchOverrides(
    formState.analysisMode,
    formState.channelIds,
    {
      triggerMode: formState.triggerMode,
      capCalendarRead: formState.capCalendarRead,
      capCalendarWrites: formState.capCalendarWrites,
      capWebSearch: formState.capWebSearch,
      capForceWebSearch: formState.capForceWebSearch,
      capReadAnalysisEvents: formState.capReadAnalysisEvents,
      capReadItems: formState.capReadItems,
      outputCalendar: formState.outputCalendar,
      outputAnalysisEvents: formState.outputAnalysisEvents,
    },
  );
  const showEventOverlap =
    formState.analysisMode === "intel_event" ||
    (formState.analysisMode === "agent" &&
      formState.triggerMode === "message_threshold" &&
      formState.channelIds.length > 0);

  if (!showBatchOverrides) {
    return null;
  }

  const overlapValue = formState.batchOverlapCount ?? 0;

  return (
    <div className="md:col-span-2 flex flex-col gap-lg" data-testid="task-schedule-overrides">
      <p className={`m-0 ${formHelpClass}`}>{t("tasks.editor.scheduleOverridesHint")}</p>

      {showEventOverlap ? (
        <div>
          <OverlapSlider
            value={String(overlapValue)}
            onChange={(val) => updateField("batchOverlapCount", Number(val))}
            label={t("tasks.editor.batchOverlapLabel")}
            ariaLabel={t("tasks.editor.batchOverlapAria")}
          />
          <p className={`mb-0 ${formHelpClass}`}>{t("tasks.editor.batchOverlapHelp")}</p>
        </div>
      ) : null}

      {showBatchOverrides ? (
        <AnalysisSchedulingFields
          idPrefix="task"
          allowFollowGlobal
          triggerThreshold={optionalNumberToInput(formState.analysisTriggerThreshold)}
          batchLimit={optionalNumberToInput(formState.analysisBatchMessageLimit)}
          evidenceStyle={formState.analysisStrategyMode ?? ""}
          onTriggerThresholdChange={(raw) =>
            updateField("analysisTriggerThreshold", parseOptionalPositiveInt(raw))
          }
          onBatchLimitChange={(raw) =>
            updateField("analysisBatchMessageLimit", parseOptionalPositiveInt(raw))
          }
          onEvidenceStyleChange={(raw) =>
            updateField(
              "analysisStrategyMode",
              raw === "" ? null : (raw as EvidenceStyle),
            )
          }
          labels={{
            // Labels shared with AI Settings; help stays task-override specific.
            triggerThreshold: t("analysis.triggerThresholdLabel", { ns: "settings" }),
            triggerThresholdHelp: t("tasks.editor.triggerThresholdHelp"),
            batchLimit: t("analysis.batchLimitLabel", { ns: "settings" }),
            batchLimitHelp: t("tasks.editor.batchLimitHelp"),
            evidenceStyle: t("analysis.evidenceStyleLabel", { ns: "settings" }),
            evidenceStyleHelp: t("tasks.editor.evidenceStyleHelp"),
            followGlobal: t("tasks.editor.followGlobal"),
            followGlobalPlaceholder: t("tasks.editor.followGlobalPlaceholder"),
          }}
        />
      ) : null}
    </div>
  );
}
