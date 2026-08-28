import { Check, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "../common/EmptyState";
import { EmptyStateGlyph } from "../common/EmptyStateGlyph";
import { Button } from "../ui";
import type { PipelineReadinessState } from "../../domain/pipeline/pipelineReadiness";

const PRESET_KEY_INSIGHTS = "key-insights";
const PRESET_SCHEDULE_EVENTS = "schedule-events";

interface PipelineGuideChecklistProps {
  state: PipelineReadinessState;
  assistantSlotReady?: boolean;
}

type PipelineGuideStep = 1 | 2 | 3 | 4;

function stepDone(
  state: PipelineReadinessState,
  assistantSlotReady: boolean,
  step: PipelineGuideStep,
): boolean {
  if (step === 1) return state !== "no_sources";
  if (step === 2) return state === "no_events" || state === "complete";
  if (step === 3) return state === "complete";
  return assistantSlotReady;
}

function stepCurrent(
  state: PipelineReadinessState,
  assistantSlotReady: boolean,
  step: PipelineGuideStep,
): boolean {
  if (step === 1) return state === "no_sources";
  if (step === 2) return state === "no_active_task";
  if (step === 3) return state === "no_events";
  return !assistantSlotReady;
}

function StepMark({
  done,
  current,
  index,
}: {
  done: boolean;
  current: boolean;
  index: number;
}) {
  if (done) {
    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-success"
        aria-hidden="true"
      >
        <Check size={12} strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      className={[
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
        current
          ? "border-accent text-accent"
          : "border-surface-border text-text-muted",
      ].join(" ")}
      aria-hidden="true"
    >
      {index}
    </span>
  );
}

export function PipelineGuideChecklist({
  state,
  assistantSlotReady = false,
}: PipelineGuideChecklistProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const steps = (
    <ol className="m-0 flex w-full max-w-[420px] list-none flex-col gap-md p-0 text-left">
      <li className="flex min-w-0 items-start gap-sm">
        <StepMark
          done={stepDone(state, assistantSlotReady, 1)}
          current={stepCurrent(state, assistantSlotReady, 1)}
          index={1}
        />
        <div className="min-w-0 flex-1">
          <div className="text-body font-medium text-text-primary">
            {t("pipelineGuide.stepSourceTitle")}
          </div>
          <p className="mt-xs text-caption leading-relaxed text-text-secondary">
            {t("pipelineGuide.stepSourceBody")}
          </p>
          {state === "no_sources" ? (
            <div className="mt-sm">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate("/sources?tab=rss")}
              >
                {t("pipelineGuide.addRss")}
              </Button>
            </div>
          ) : null}
        </div>
      </li>
      <li className="flex min-w-0 items-start gap-sm">
        <StepMark
          done={stepDone(state, assistantSlotReady, 2)}
          current={stepCurrent(state, assistantSlotReady, 2)}
          index={2}
        />
        <div className="min-w-0 flex-1">
          <div className="text-body font-medium text-text-primary">
            {t("pipelineGuide.stepTaskTitle")}
          </div>
          <p className="mt-xs text-caption leading-relaxed text-text-secondary">
            {t("pipelineGuide.stepTaskBody")}
          </p>
          <p className="mt-xs text-caption leading-relaxed text-text-muted">
            {t("pipelineGuide.telegramHint")}
          </p>
          {state === "no_active_task" ? (
            <div className="mt-sm flex flex-wrap gap-sm">
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  navigate(`/tasks/new?preset=${PRESET_KEY_INSIGHTS}`)
                }
              >
                {t("pipelineGuide.presetKeyInsights")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  navigate(`/tasks/new?preset=${PRESET_SCHEDULE_EVENTS}`)
                }
              >
                {t("pipelineGuide.presetScheduleEvents")}
              </Button>
            </div>
          ) : null}
        </div>
      </li>
      <li className="flex min-w-0 items-start gap-sm">
        <StepMark
          done={stepDone(state, assistantSlotReady, 3)}
          current={stepCurrent(state, assistantSlotReady, 3)}
          index={3}
        />
        <div className="min-w-0 flex-1">
          <div className="text-body font-medium text-text-primary">
            {t("pipelineGuide.stepEventsTitle")}
          </div>
          <p className="mt-xs text-caption leading-relaxed text-text-secondary">
            {t("pipelineGuide.stepEventsBody")}
          </p>
        </div>
      </li>
      <li className="flex min-w-0 items-start gap-sm">
        <StepMark
          done={stepDone(state, assistantSlotReady, 4)}
          current={stepCurrent(state, assistantSlotReady, 4)}
          index={4}
        />
        <div className="min-w-0 flex-1">
          <div className="text-body font-medium text-text-primary">
            {t("pipelineGuide.stepAiTitle")}
          </div>
          <p className="mt-xs text-caption leading-relaxed text-text-secondary">
            {t("pipelineGuide.stepAiBody")}
          </p>
          {!assistantSlotReady ? (
            <div className="mt-sm">
              <Button
                variant="secondary"
                size="sm"
                data-testid="pipeline-guide-ai-provider"
                onClick={() => navigate("/ai/provider")}
              >
                {t("pipelineGuide.openAiProvider")}
              </Button>
            </div>
          ) : null}
        </div>
      </li>
    </ol>
  );

  return (
    <div data-testid="pipeline-guide-checklist">
      <EmptyState
        className="im-enter-rise"
        illustration={<EmptyStateGlyph icon={ListChecks} />}
        title={t("pipelineGuide.title")}
        description={t("pipelineGuide.description")}
        actions={steps}
      />
    </div>
  );
}
