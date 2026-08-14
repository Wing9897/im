/**
 * Read-focused agent surface under Tasks — children, owned events, sources, last tick.
 * Route: `/tasks/:taskId/agent` (not a top-level nav peer of Sources / Assistant).
 * Legacy `/tasks/:taskId/project` is retired (no redirect).
 */

import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Pencil, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { EmptyState } from "../../../components/common/EmptyState";
import { SkeletonScreen } from "../../../components/common/SkeletonScreen";
import {
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
} from "../../../components/task/taskFormAnalysisModeMeta";
import { MODE_BADGE_TONE } from "../../../components/task/analysisModeBadgeTone";
import { TaskEmployeeAvatar } from "../../../components/task/TaskEmployeeAvatar";
import {
  AppPageShell,
  Badge,
  Button,
  PanelSection,
} from "../../../components/ui";
import { pageTitleClass, captionClass } from "../../../components/ui/pageTypography";
import { colorStatusDotStyle } from "../../../styles/statusDot";
import { scheduleFieldsFromTask } from "../../../domain/tasks/taskFormUtils";
import { formatAnalysisTimeRangeNullable } from "../../../utils/analysis";
import { useErrorToast } from "../../../hooks/useErrorToast";
import { ExpandableErrorText, formatIsoLocal } from "./agentDetailFormat";
import { AgentDetailSourcesSection } from "./AgentDetailSourcesSection";
import { AgentDetailTickSection } from "./AgentDetailTickSection";
import { useAgentDetail } from "./useAgentDetail";

export function AgentDetailPage() {
  const { t } = useTranslation("common");
  const {
    project,
    children,
    channelLabels,
    events,
    eventsLoading,
    eventsError,
    activitySpan,
    tickStatus,
    spanLoading,
    isRunning,
    lastErrorMessage,
    batchRetryCount,
    showAnalysisPaused,
    loading,
    catalogError,
    notFound,
    reload,
    goBack,
    goEdit,
    goEditChild,
    goTimeline,
  } = useAgentDetail();

  const [childrenOpen, setChildrenOpen] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(false);

  useErrorToast(catalogError);
  useErrorToast(eventsError);

  useEffect(() => {
    setChildrenOpen(children.length > 0);
  }, [children.length]);

  if (notFound) {
    return <Navigate to="/tasks" replace />;
  }

  if (loading || !project) {
    return (
      <AppPageShell>
        <SkeletonScreen variant="list-rows" count={4} />
      </AppPageShell>
    );
  }

  const employeeId = getTaskEmployeeIdForMode(project.analysisMode);
  const employeeName = getTaskEmployeeDisplayName(employeeId);
  const timeRange =
    formatAnalysisTimeRangeNullable(project.analysisTimeRange) ?? project.analysisTimeRange;
  const scheduleFields = scheduleFieldsFromTask(project);
  const scheduleLabel = [scheduleFields.scheduleType, scheduleFields.scheduleValue]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(" · ");

  return (
    <AppPageShell>
      <header
        className="mb-md flex min-w-0 flex-wrap items-center gap-sm"
        data-testid="project-detail-toolbar"
      >
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={goBack}
          aria-label={t("tasks:editor.back")}
          title={t("tasks:editor.back")}
        >
          <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-sm">
          <TaskEmployeeAvatar employeeId={employeeId} size="sm" label={employeeName} />
          <h1 className={`min-w-0 truncate ${pageTitleClass}`}>{project.name}</h1>
          <Badge tone={MODE_BADGE_TONE.agent} className="shrink-0 normal-case tracking-normal">
            {employeeName}
          </Badge>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-sm">
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              void reload();
            }}
            aria-label={t("tasks:agentDetail.reload")}
            title={t("tasks:agentDetail.reload")}
            data-testid="project-detail-reload"
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t("tasks:agentDetail.reload")}
          </Button>
          <Button variant="secondary" size="md" onClick={goTimeline}>
            {t("tasks:agentDetail.openTimeline")}
          </Button>
          <Button variant="primary" size="md" onClick={goEdit}>
            <Pencil size={14} aria-hidden="true" />
            {t("edit")}
          </Button>
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-md" data-testid="project-detail-body">
        <PanelSection title={t("tasks:agentDetail.metaTitle")}>
          <div className="flex min-w-0 flex-col gap-sm text-body text-text-secondary">
            <div className="flex flex-wrap items-center gap-sm leading-normal">
              <span className="inline-flex items-center gap-xs">
                <span
                  style={colorStatusDotStyle(
                    project.isActive ? "var(--success)" : "var(--text-muted)",
                  )}
                  aria-hidden="true"
                />
                {project.isActive ? t("enable") : t("disable")}
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
            {project.description?.trim() ? (
              <p className="break-words whitespace-pre-wrap text-text-primary leading-relaxed">
                {project.description.trim()}
              </p>
            ) : (
              <p className={captionClass}>{t("tasks:agentDetail.noDescription")}</p>
            )}
            <p className="break-words">
              {t("tasks:detail.timeRange", { range: timeRange || t("emDash") })}
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

        <AgentDetailSourcesSection channelLabels={channelLabels} />

        <PanelSection
          title={t("tasks:agentDetail.childrenTitle")}
          showCount
          itemCount={children.length}
          collapsible
          open={childrenOpen}
          onOpenChange={setChildrenOpen}
        >
          {children.length === 0 ? (
            <EmptyState
              title={t("tasks:agentDetail.childrenEmptyTitle")}
              description={t("tasks:agentDetail.childrenEmptyDescription")}
            />
          ) : (
            <ul className="flex flex-col gap-sm" data-testid="project-detail-children">
              {children.map((child) => (
                <li
                  key={child.id}
                  className="flex min-w-0 items-center justify-between gap-sm rounded-lg border border-surface-border/70 px-sm py-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-xs">
                      <CalendarDays size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
                      <span className="truncate font-medium text-text-primary">{child.name}</span>
                      {!child.isActive ? (
                        <Badge tone="neutral" className="shrink-0 normal-case tracking-normal">
                          {t("tasks:card.disabled")}
                        </Badge>
                      ) : null}
                    </div>
                    {child.rrule.trim() ? (
                      <p className={`${captionClass} mt-0.5 truncate`}>
                        {child.rrule}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goEditChild(child)}
                    aria-label={t("tasks:card.editAria", { name: child.name })}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </PanelSection>

        <PanelSection
          title={t("tasks:agentDetail.eventsTitle")}
          showCount={!eventsLoading}
          itemCount={events.length}
          collapsible
          open={eventsOpen}
          onOpenChange={setEventsOpen}
        >
          {eventsLoading ? (
            <p className={captionClass}>{t("ui.loading")}</p>
          ) : events.length === 0 ? (
            <EmptyState
              title={t("tasks:agentDetail.eventsEmptyTitle")}
              description={t("tasks:agentDetail.eventsEmptyDescription")}
            />
          ) : (
            <ul className="flex flex-col gap-sm" data-testid="project-detail-events">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="min-w-0 rounded-lg border border-surface-border/70 px-sm py-xs"
                >
                  <div className="truncate font-medium text-text-primary">{event.title}</div>
                  <p className={`${captionClass} mt-0.5 break-words`}>
                    {formatIsoLocal(event.startTime)}
                    {event.location?.trim() ? ` · ${event.location.trim()}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PanelSection>

        <AgentDetailTickSection
          tickStatus={tickStatus}
          activitySpan={activitySpan}
          spanLoading={spanLoading}
        />
      </div>
    </AppPageShell>
  );
}
