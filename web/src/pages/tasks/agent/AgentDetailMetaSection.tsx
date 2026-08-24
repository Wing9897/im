import { useTranslation } from "react-i18next";

import { PanelSection } from "../../../components/ui";
import { captionClass } from "../../../components/ui/pageTypography";
import { colorStatusDotStyle } from "../../../styles/statusDot";
import { ExpandableErrorText } from "./agentDetailFormat";

type Props = {
  isActive: boolean;
  isRunning: boolean;
  description: string | null | undefined;
  timeRangeLabel: string;
  scheduleLabel: string;
  lastErrorMessage: string | null;
  batchRetryCount: number;
  showAnalysisPaused: boolean;
};

export function AgentDetailMetaSection({
  isActive,
  isRunning,
  description,
  timeRangeLabel,
  scheduleLabel,
  lastErrorMessage,
  batchRetryCount,
  showAnalysisPaused,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <PanelSection title={t("tasks:agentDetail.metaTitle")}>
      <div className="flex min-w-0 flex-col gap-sm text-body text-text-secondary">
        <div className="flex flex-wrap items-center gap-sm leading-normal">
          <span className="inline-flex items-center gap-xs">
            <span
              style={colorStatusDotStyle(
                isActive ? "var(--success)" : "var(--text-muted)",
              )}
              aria-hidden="true"
            />
            {isActive ? t("enable") : t("disable")}
          </span>
          <span className="inline-flex items-center gap-xs">
            <span
              style={colorStatusDotStyle(
                isRunning ? "var(--success)" : "var(--text-muted)",
              )}
              aria-hidden="true"
            />
            {isRunning ? t("tasks:card.running") : t("tasks:card.idle")}
          </span>
        </div>
        {description?.trim() ? (
          <p className="break-words whitespace-pre-wrap text-text-primary leading-relaxed">
            {description.trim()}
          </p>
        ) : (
          <p className={captionClass}>{t("tasks:agentDetail.noDescription")}</p>
        )}
        <p className="break-words">
          {t("tasks:detail.timeRange", { range: timeRangeLabel || t("emDash") })}
        </p>
        {scheduleLabel ? (
          <p className="break-words">
            {t("tasks:agentDetail.schedule", { schedule: scheduleLabel })}
          </p>
        ) : null}
        {lastErrorMessage || batchRetryCount > 0 || showAnalysisPaused ? (
          <div
            className="flex min-w-0 flex-col gap-xs rounded-md border border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] px-sm py-xs text-caption leading-relaxed"
            data-testid="project-detail-batch-attention"
          >
            {lastErrorMessage ? (
              <div className="text-error" data-testid="project-detail-batch-error">
                <span className="font-medium">
                  {t("tasks:agentDetail.batchAttentionTitle")}
                  {": "}
                </span>
                <ExpandableErrorText text={lastErrorMessage} />
              </div>
            ) : null}
            {batchRetryCount > 0 ? (
              <div className="text-warning" data-testid="project-detail-batch-retry">
                {t("tasks:agentDetail.batchRetry", { count: batchRetryCount })}
              </div>
            ) : null}
            {showAnalysisPaused ? (
              <div className="text-warning" data-testid="project-detail-analysis-paused">
                {t("tasks:agentDetail.analysisPausedHint")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </PanelSection>
  );
}
