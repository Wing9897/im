import { CheckCircle2, Inbox, ListTodo } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge, CardFieldIcon } from "../ui";
import type { TaskCardStats } from "../../types/dashboard";

type Props = {
  taskId: string;
  hideAnalysisStats: boolean;
  isAgentMode: boolean;
  isAgentCalendarMode: boolean;
  isActive: boolean;
  isAnalyzing: boolean;
  stats: TaskCardStats;
  queuedMessageCount: number;
  attentionErrorText: string | null;
};

export function TaskCardStatsSection({
  taskId,
  hideAnalysisStats,
  isAgentMode,
  isAgentCalendarMode,
  isActive,
  isAnalyzing,
  stats,
  queuedMessageCount,
  attentionErrorText,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <>
      {hideAnalysisStats ? (
        <div
          className="text-[11px] leading-snug text-text-muted"
          data-testid={`task-card-schedule-hint-${taskId}`}
        >
          {isAgentMode
            ? t("tasks:card.agentProgressHint")
            : t("tasks:card.calendarTaskProgressHint")}
          {isAgentCalendarMode && queuedMessageCount > 0 ? (
            <span className="mt-0.5 block tabular-nums text-warning">
              {t("tasks:card.queued")}: {queuedMessageCount.toLocaleString()}
            </span>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-sm text-[11px]">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-xs text-text-muted">
                <CardFieldIcon icon={Inbox} />
                {t("tasks:card.unanalyzed")}
              </span>
              <span className="tabular-nums font-medium text-text-primary">
                {stats.unanalyzedCount.toLocaleString()}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span
                className="flex items-center gap-xs text-text-muted"
                title={t("tasks:card.queuedTitle")}
              >
                <CardFieldIcon icon={ListTodo} />
                {t("tasks:card.queued")}
              </span>
              <span
                className={`tabular-nums font-medium ${
                  queuedMessageCount > 0 ? "text-warning" : "text-text-primary"
                }`}
              >
                {queuedMessageCount.toLocaleString()}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-xs text-text-muted">
                <CardFieldIcon icon={CheckCircle2} />
                {t("tasks:card.analyzed")}
              </span>
              <span className="tabular-nums font-medium text-text-primary">
                {stats.analyzedCount.toLocaleString()}
              </span>
            </div>
          </div>
          {isActive &&
          !isAnalyzing &&
          stats.unanalyzedCount > 0 &&
          stats.unanalyzedCount < stats.triggerThreshold ? (
            <div
              className="text-[11px] leading-snug text-text-muted"
              data-testid={`task-card-waiting-threshold-${taskId}`}
            >
              {t("tasks:card.waitingForThreshold", {
                count: stats.unanalyzedCount,
                threshold: stats.triggerThreshold,
              })}
            </div>
          ) : null}
        </>
      )}

      {!hideAnalysisStats &&
      (attentionErrorText || (stats.retryCount ?? 0) > 0 || stats.analysisPaused) ? (
        <div
          className="flex flex-col gap-0.5 text-[11px] leading-snug"
          data-testid={`task-card-attention-${taskId}`}
        >
          {attentionErrorText ? (
            <div
              className="text-error line-clamp-2"
              title={attentionErrorText}
              data-testid={`task-card-error-${taskId}`}
            >
              <Badge tone="danger" className="mr-1 align-middle">
                {t("board:queue.attention")}
              </Badge>
              {attentionErrorText}
            </div>
          ) : null}
          {(stats.retryCount ?? 0) > 0 ? (
            <span className="text-warning" data-testid={`task-card-retry-${taskId}`}>
              {t("tasks:card.retryCount", { count: stats.retryCount })}
            </span>
          ) : null}
          {stats.analysisPaused ? (
            <span className="text-warning" data-testid={`task-card-paused-${taskId}`}>
              <Badge tone="warning" className="mr-1 align-middle">
                {t("board:queue.paused")}
              </Badge>
              {t("tasks:card.analysisPausedHint")}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
