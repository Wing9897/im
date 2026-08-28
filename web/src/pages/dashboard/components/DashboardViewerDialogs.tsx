import type { TFunction } from "i18next";

import { ConfirmDialog } from "../../../components/dialogs/ConfirmDialog";
import { DeleteConfirmDialog } from "../../../components/dialogs/DeleteConfirmDialog";
import { WorksetNameDialog } from "../../../components/dialogs/WorksetNameDialog";
import type { TaskCardStats } from "../../../types/dashboard";
import type { AnalysisTask } from "../../../types/tasks";
import { TaskDetailView } from "./TaskDetailDialog";

export type DashboardWorksetNameDialogState =
  | { mode: "create" }
  | { mode: "rename"; id: string; name: string };

interface DashboardViewerDialogsProps {
  t: TFunction;
  taskDeleteTarget: { id: string; name: string } | null;
  taskDeleting: boolean;
  worksetNameDialog: DashboardWorksetNameDialogState | null;
  worksetNameBusy: boolean;
  worksetDeleteTarget: { id: string; name: string } | null;
  worksetDeleting: boolean;
  detailTask: AnalysisTask | null;
  detailStats: TaskCardStats;
  channelNameById: ReadonlyMap<string, string>;
  onConfirmTaskDelete: () => Promise<void>;
  onCancelTaskDelete: () => void;
  onCloseWorksetNameDialog: () => void;
  onSubmitWorksetName: (values: { name: string; description: string; cover: string }) => Promise<void>;
  onConfirmWorksetDelete: () => Promise<void>;
  onCancelWorksetDelete: () => void;
  onCloseTaskDetail: () => void;
  onEditDetailTask: () => void;
}

/** Modal and confirmation layer kept separate from dashboard list rendering. */
export function DashboardViewerDialogs({
  t,
  taskDeleteTarget,
  taskDeleting,
  worksetNameDialog,
  worksetNameBusy,
  worksetDeleteTarget,
  worksetDeleting,
  detailTask,
  detailStats,
  channelNameById,
  onConfirmTaskDelete,
  onCancelTaskDelete,
  onCloseWorksetNameDialog,
  onSubmitWorksetName,
  onConfirmWorksetDelete,
  onCancelWorksetDelete,
  onCloseTaskDetail,
  onEditDetailTask,
}: DashboardViewerDialogsProps) {
  return (
    <>
      <DeleteConfirmDialog
        open={taskDeleteTarget !== null}
        targetName={taskDeleteTarget?.name ?? ""}
        onConfirm={onConfirmTaskDelete}
        onCancel={onCancelTaskDelete}
        deleting={taskDeleting}
      />

      <WorksetNameDialog
        open={worksetNameDialog !== null}
        mode={worksetNameDialog?.mode ?? "create"}
        initialName={
          worksetNameDialog?.mode === "rename" ? worksetNameDialog.name : ""
        }
        busy={worksetNameBusy}
        onClose={onCloseWorksetNameDialog}
        onSubmit={onSubmitWorksetName}
      />

      {worksetDeleteTarget ? (
        <ConfirmDialog
          title={t("workset:deleteTitle")}
          body={t("workset:deleteConfirm", { name: worksetDeleteTarget.name })}
          confirmLabel={t("dialog.confirmDelete")}
          confirmBusyLabel={t("dialog.deleting")}
          busy={worksetDeleting}
          onCancel={onCancelWorksetDelete}
          onConfirm={onConfirmWorksetDelete}
        />
      ) : null}

      {detailTask ? (
        <TaskDetailView
          task={detailTask}
          stats={detailStats}
          channelNameById={channelNameById}
          onClose={onCloseTaskDetail}
          onEdit={onEditDetailTask}
          presentation="modal"
        />
      ) : null}
    </>
  );
}
