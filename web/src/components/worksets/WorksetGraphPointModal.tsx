import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { ModalDialog } from "../ModalDialog";
import { NotifyPrefField } from "../notify/NotifyPrefField";
import { WorksetPermissionToggles } from "../WorksetPermissionToggles";
import { Button, SelectTile, SelectTileGrid } from "../ui";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import type { NotifyPref } from "../../domain/notify/notifyPref";
import type { PipelinePoint } from "../../domain/worksets/worksetPipelineGraph";
import { toError } from "../../utils/errors";
import type { WorksetPipelineGraphData } from "./useWorksetPipelineGraphData";
import { patchPipelineTask, type GraphPatchDeps } from "./worksetGraphPatches";

type Props = {
  point: PipelinePoint | null;
  data: WorksetPipelineGraphData;
  onClose: () => void;
};

function OpenPageFooter({
  href,
  onClose,
}: {
  href: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("workset");
  const navigate = useNavigate();
  return (
    <>
      <Button type="button" variant="secondary" onClick={onClose}>
        {t("graphModalClose")}
      </Button>
      <Button
        type="button"
        variant="primary"
        data-testid="workset-graph-open-page"
        onClick={() => {
          onClose();
          navigate(href);
        }}
      >
        {t("graphModalOpenPage")}
      </Button>
    </>
  );
}

function TaskSwitchFields({
  point,
  data,
  deps,
}: {
  point: PipelinePoint;
  data: WorksetPipelineGraphData;
  deps: GraphPatchDeps;
}) {
  const { t } = useTranslation("workset");
  const task = data.tasks.find((row) => row.id === point.entityId);
  if (!task) return null;
  return (
    <>
      <SelectTileGrid columns="1fr" className="gap-sm">
        {task.analysisMode !== "leaderboard" ? (
          <SelectTile
            compact
            variant="toggle"
            active={task.outputAnalysisEvents !== false}
            data-testid="workset-graph-task-intel"
            onClick={() =>
              void patchPipelineTask(
                task,
                { outputAnalysisEvents: task.outputAnalysisEvents === false },
                deps,
              )
            }
          >
            {t("graphOutputIntel")}
          </SelectTile>
        ) : null}
        <SelectTile
          compact
          variant="toggle"
          active={task.includeInTimeline !== false}
          data-testid="workset-graph-task-timeline"
          onClick={() =>
            void patchPipelineTask(
              task,
              { includeInTimeline: task.includeInTimeline === false },
              deps,
            )
          }
        >
          {t("graphOutputTimeline")}
        </SelectTile>
        {task.analysisMode === "agent" ? (
          <SelectTile
            compact
            variant="toggle"
            active={task.outputCalendar === true}
            data-testid="workset-graph-task-calendar"
            onClick={() =>
              void patchPipelineTask(task, { outputCalendar: task.outputCalendar !== true }, deps)
            }
          >
            {t("graphOutputCalendar")}
          </SelectTile>
        ) : null}
        <NotifyPrefField
          value={task.notifyPref}
          testId="workset-graph-task-notify"
          variant="tile"
          onChange={(next: NotifyPref) => void patchPipelineTask(task, { notifyPref: next }, deps)}
        />
      </SelectTileGrid>
    </>
  );
}

/** Canvas modal: output switches plus jump. Ownership changes use click-to-connect. */
export function WorksetGraphPointModal({ point, data, onClose }: Props) {
  const { t } = useTranslation("workset");
  const { refreshTasks, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();

  const deps = useMemo<GraphPatchDeps>(
    () => ({
      refreshTasks,
      refreshWorksets,
      reloadGraph: data.reload,
      onError: (error) => showToast(toError(error).message, "error"),
    }),
    [data.reload, refreshTasks, refreshWorksets, showToast],
  );

  if (!point) return null;

  const isWorkset = point.kind === "workset";
  const isTask = point.kind === "task";
  const worksetRow = isWorkset ? data.worksets.find((row) => row.id === point.entityId) : undefined;

  return (
    <ModalDialog
      open
      title={point.label}
      ariaLabel={t("graphModalAria")}
      onClose={onClose}
      testId="workset-graph-point-modal"
      size="compact"
      footer={<OpenPageFooter href={point.href} onClose={onClose} />}
    >
      {worksetRow ? (
        <WorksetPermissionToggles worksetId={worksetRow.id} worksetName={point.label} />
      ) : null}
      {isTask ? <TaskSwitchFields point={point} data={data} deps={deps} /> : null}
    </ModalDialog>
  );
}
