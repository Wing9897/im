/**
 * Last-tick summary + recent tick log for project detail.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { AgentToolCallSummary } from "../../../api/agent";
import { AssistantToolSummary } from "../../../components/assistant/AssistantToolSteps";
import { Badge, Button, PanelSection } from "../../../components/ui";
import { captionClass } from "../../../components/ui/pageTypography";
import type { AgentTickStatus, TaskActivitySpan } from "../../../types/analysis";
import { ExpandableErrorText, formatIsoLocal } from "./agentDetailFormat";
import {
  buildAgentTickSummaryView,
  deriveTickOutcome,
  tickOutcomeTone,
  type TickOutcome,
} from "./agentTickSummary";

interface AgentDetailTickSectionProps {
  tickStatus: AgentTickStatus | null;
  activitySpan: TaskActivitySpan | null;
  spanLoading: boolean;
}

export function AgentDetailTickSection({
  tickStatus,
  activitySpan,
  spanLoading,
}: AgentDetailTickSectionProps) {
  const { t } = useTranslation("common");
  const [tickExtrasOpen, setTickExtrasOpen] = useState(false);
  const [tickLogOpen, setTickLogOpen] = useState(true);

  const tickView = useMemo(
    () => buildAgentTickSummaryView(tickStatus, activitySpan),
    [tickStatus, activitySpan],
  );

  const {
    latestTick,
    inFlight,
    outcome: lastOutcome,
    errorMessage: lastTickError,
    messageCount: lastMessageCount,
    pendingSinceCursor,
    tickLog,
    toolCalls,
    agentMessage,
  } = tickView;

  const outcomeLabel = (outcome: TickOutcome) => {
    const key =
      outcome === "success"
        ? "tickOutcomeSuccess"
        : outcome === "skipped"
          ? "tickOutcomeSkipped"
          : outcome === "running"
            ? "tickOutcomeRunning"
            : "tickOutcomeError";
    return t(`tasks.agentDetail.${key}`);
  };

  return (
    <>
      <PanelSection title={t("tasks.agentDetail.tickTitle")}>
        {spanLoading && !activitySpan && !tickStatus ? (
          <p className={captionClass}>{t("ui.loading")}</p>
        ) : (
          <div className="flex min-w-0 flex-col gap-sm" data-testid="project-detail-tick">
            <dl className="grid gap-sm text-body sm:grid-cols-2">
              <div className="min-w-0">
                <dt className={captionClass}>{t("tasks.agentDetail.tickLastEnd")}</dt>
                <dd className="break-words text-text-primary">
                  {formatIsoLocal(latestTick?.completedAt ?? activitySpan?.latestBatchEnd) ||
                    t("emDash")}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className={captionClass}>{t("tasks.agentDetail.tickCompletedCount")}</dt>
                <dd className="text-text-primary tabular-nums">
                  {activitySpan?.completedBatchCount ?? 0}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className={captionClass}>{t("tasks.agentDetail.tickOutcome")}</dt>
                <dd className="text-text-primary" data-testid="project-detail-tick-outcome">
                  {lastOutcome ? (
                    <Badge
                      tone={tickOutcomeTone(lastOutcome)}
                      className="normal-case tracking-normal"
                    >
                      {outcomeLabel(lastOutcome)}
                    </Badge>
                  ) : (
                    t("emDash")
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className={captionClass}>{t("tasks.agentDetail.tickMessageCount")}</dt>
                <dd
                  className="text-text-primary tabular-nums"
                  data-testid="project-detail-tick-message-count"
                >
                  {lastMessageCount != null ? lastMessageCount.toLocaleString() : t("emDash")}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className={captionClass}>{t("tasks.agentDetail.tickPendingCursor")}</dt>
                <dd
                  className="text-text-primary tabular-nums"
                  data-testid="project-detail-pending-cursor"
                >
                  {pendingSinceCursor != null
                    ? pendingSinceCursor.toLocaleString()
                    : t("emDash")}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className={captionClass}>{t("tasks.agentDetail.tickCursorAt")}</dt>
                <dd className="break-words text-text-primary">
                  {formatIsoLocal(tickStatus?.cursorAt) || t("emDash")}
                </dd>
              </div>
            </dl>
            {lastTickError ? (
              <div
                className="min-w-0 rounded-md border border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] px-sm py-xs text-caption leading-relaxed text-error"
                data-testid="project-detail-tick-error"
              >
                <span className="font-medium">{t("tasks.agentDetail.tickError")}: </span>
                <ExpandableErrorText text={lastTickError} />
              </div>
            ) : null}

            <div>
              <Button
                type="button"
                variant="ghost"
                size="inline"
                onClick={() => setTickExtrasOpen((value) => !value)}
                aria-expanded={tickExtrasOpen}
                data-testid="project-detail-tick-extras-toggle"
              >
                {tickExtrasOpen
                  ? t("tasks.agentDetail.hideTickExtras")
                  : t("tasks.agentDetail.showTickExtras")}
              </Button>
              {tickExtrasOpen ? (
                <div className="mt-sm flex min-w-0 flex-col gap-sm">
                  <div data-testid="project-detail-tick-message">
                    <div className={captionClass}>{t("tasks.agentDetail.tickMessage")}</div>
                    {agentMessage ? (
                      <p className="mt-0.5 break-words whitespace-pre-wrap text-body leading-relaxed text-text-primary">
                        {agentMessage}
                      </p>
                    ) : (
                      <p className={`mt-0.5 ${captionClass}`}>
                        {t("tasks.agentDetail.tickNoMessage")}
                      </p>
                    )}
                  </div>
                  <div data-testid="project-detail-tick-tools">
                    {toolCalls.length > 0 ? (
                      <AssistantToolSummary
                        toolCalls={toolCalls.map(
                          (call): AgentToolCallSummary => ({
                            name: call.name,
                            arguments: call.arguments ?? {},
                            resultSummary: call.resultSummary ?? "",
                          }),
                        )}
                        testId="project-detail-tool-summary"
                      />
                    ) : (
                      <>
                        <div className={captionClass}>{t("tasks.agentDetail.tickTools")}</div>
                        <p className={`mt-0.5 ${captionClass}`}>
                          {t("tasks.agentDetail.tickNoTools")}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </PanelSection>

      <PanelSection
        title={t("tasks.agentDetail.tickLogTitle")}
        showCount={!spanLoading}
        itemCount={tickLog.length}
        collapsible
        open={tickLogOpen}
        onOpenChange={setTickLogOpen}
      >
        {spanLoading && tickLog.length === 0 ? (
          <p className={captionClass}>{t("ui.loading")}</p>
        ) : tickLog.length === 0 ? (
          <p className={captionClass} data-testid="project-detail-tick-log-empty">
            {inFlight
              ? t("tasks.agentDetail.tickLogEmptyInFlight")
              : t("tasks.agentDetail.tickLogEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-sm" data-testid="project-detail-tick-log">
            {tickLog.map((entry) => {
              const outcome = deriveTickOutcome(entry) ?? "success";
              return (
                <li
                  key={entry.batchId}
                  className="min-w-0 rounded-lg border border-surface-border/70 px-sm py-xs text-body"
                  data-testid={`agent-tick-log-${entry.batchId}`}
                >
                  <div className="flex flex-wrap items-center gap-xs">
                    <Badge tone={tickOutcomeTone(outcome)} className="normal-case tracking-normal">
                      {outcomeLabel(outcome)}
                    </Badge>
                    <span className="tabular-nums text-text-muted">
                      {entry.messageCount.toLocaleString()} msg
                    </span>
                    <span className={`${captionClass} ml-auto`}>
                      {formatIsoLocal(entry.completedAt) || t("emDash")}
                    </span>
                  </div>
                  {entry.errorMessage?.trim() ? (
                    <div className="mt-0.5 text-caption text-error">
                      <ExpandableErrorText text={entry.errorMessage.trim()} />
                    </div>
                  ) : entry.agentMessage?.trim() ? (
                    <p className="mt-0.5 line-clamp-3 break-words whitespace-pre-wrap text-caption text-text-secondary">
                      {entry.agentMessage.trim()}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PanelSection>
    </>
  );
}
