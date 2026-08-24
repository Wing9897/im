/**
 * Read-focused agent surface under Tasks — children, owned events, sources, last tick.
 * Route: `/tasks/:taskId/agent` (not a top-level nav peer of Sources / Assistant).
 * Legacy `/tasks/:taskId/project` is retired (no redirect).
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";

import { SkeletonScreen } from "../../../components/common/SkeletonScreen";
import {
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
} from "../../../components/task/taskFormAnalysisModeMeta";
import { AppPageShell } from "../../../components/ui";
import { ConfirmDialog } from "../../../components/dialogs/ConfirmDialog";
import { scheduleFieldsFromTask } from "../../../domain/tasks/taskFormUtils";
import { formatAnalysisTimeRangeNullable } from "../../../utils/analysis";
import { useErrorToast } from "../../../hooks/useErrorToast";
import { AgentDetailChildrenSection } from "./AgentDetailChildrenSection";
import { AgentDetailEventsSection } from "./AgentDetailEventsSection";
import { AgentDetailHeader } from "./AgentDetailHeader";
import { AgentDetailMetaSection } from "./AgentDetailMetaSection";
import { AgentDetailSourcesSection } from "./AgentDetailSourcesSection";
import { AgentDetailTickSection } from "./AgentDetailTickSection";
import { useAgentDetail } from "./useAgentDetail";
import { useAgentDetailRetract } from "./useAgentDetailRetract";

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
  const retract = useAgentDetailRetract({
    taskId: project?.id ?? "",
    ticks: tickStatus?.ticks,
    events,
    children,
    reload,
  });

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
      <AgentDetailHeader
        name={project.name}
        employeeId={employeeId}
        employeeName={employeeName}
        retractBusy={retract.busy}
        onBack={goBack}
        onReload={() => {
          void reload();
        }}
        onTimeline={goTimeline}
        onRetract={retract.requestRetract}
        onEdit={goEdit}
      />

      <div className="flex min-w-0 flex-col gap-md" data-testid="project-detail-body">
        <AgentDetailMetaSection
          isActive={project.isActive}
          isRunning={isRunning}
          description={project.description}
          timeRangeLabel={timeRange}
          scheduleLabel={scheduleLabel}
          lastErrorMessage={lastErrorMessage}
          batchRetryCount={batchRetryCount}
          showAnalysisPaused={showAnalysisPaused}
        />

        <AgentDetailSourcesSection channelLabels={channelLabels} />

        <AgentDetailChildrenSection
          series={children}
          open={childrenOpen}
          onOpenChange={setChildrenOpen}
          onEditChild={goEditChild}
        />

        <AgentDetailEventsSection
          events={events}
          eventsLoading={eventsLoading}
          open={eventsOpen}
          onOpenChange={setEventsOpen}
        />

        <AgentDetailTickSection
          tickStatus={tickStatus}
          activitySpan={activitySpan}
          spanLoading={spanLoading}
        />
      </div>
      {retract.confirmOpen ? (
        <ConfirmDialog
          title={t("tasks:agentDetail.retractLastWave")}
          body={t("tasks:agentDetail.retractConfirm")}
          confirmLabel={t("tasks:agentDetail.retractLastWave")}
          confirmBusyLabel={t("ui.loading")}
          busy={retract.busy}
          onCancel={retract.cancelRetract}
          onConfirm={retract.confirmRetract}
        />
      ) : null}
    </AppPageShell>
  );
}
