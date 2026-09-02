import { useCallback, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { EmptyState } from "../../components/common/EmptyState";
import { EmptyStateGlyph } from "../../components/common/EmptyStateGlyph";
import { Layers } from "lucide-react";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { WorksetNameDialog } from "../../components/dialogs/WorksetNameDialog";
import { WorksetCoverField } from "../../components/WorksetCoverField";
import { WorksetPermissionToggles } from "../../components/WorksetPermissionToggles";
import { AppPageShell, Badge, Button, OpsControlBar, pageTitleClass } from "../../components/ui";
import { deleteWorkset, updateWorkset } from "../../api/worksets";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { useToast } from "../../context/ToastContext";
import { WORKSETS_PATH } from "../../domain/worksets/worksetRoutes";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { toError } from "../../utils/errors";
import { WorksetCatalogChrome } from "./WorksetCatalogChrome";
import { WorksetContentsPanel } from "./WorksetContentsPanel";

/** Full-page workset contents: tasks / items / events plus rename/delete / notify. */
export function WorksetWorkspacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { worksetId: routeWorksetId } = useParams<{ worksetId?: string }>();
  const { worksets, worksetsLoading, tasks, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();

  const worksetId = routeWorksetId ? decodeURIComponent(routeWorksetId) : "";

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const workset = useMemo(() => {
    if (!worksetId) return null;
    return worksets.find((row) => row.id === worksetId) ?? null;
  }, [worksetId, worksets]);

  const title = useMemo(() => {
    if (!workset) return "";
    return workset.id === SYSTEM_WORKSET_ID ? t("workset:generalName") : workset.name;
  }, [t, workset]);

  const isSystem = Boolean(workset?.isSystem) || workset?.id === SYSTEM_WORKSET_ID;
  const memberTasks = useMemo(
    () => tasks.filter((task) => task.worksetId === worksetId),
    [tasks, worksetId],
  );

  const goCatalog = useCallback(() => {
    navigate(WORKSETS_PATH);
  }, [navigate]);

  const handleSave = useCallback(
    async (values: { name: string; description: string; cover: string }) => {
      if (!workset) return;
      setRenameBusy(true);
      try {
        await updateWorkset(workset.id, {
          ...(isSystem ? {} : { name: values.name }),
          description: values.description,
        });
        await refreshWorksets();
        showToast(
          isSystem
            ? t("workset:updatedToast", { name: title })
            : t("workset:renamedToast", { name: values.name }),
          "success",
        );
        setRenameOpen(false);
      } catch (error) {
        showToast(toError(error).message, "error");
      } finally {
        setRenameBusy(false);
      }
    },
    [isSystem, refreshWorksets, showToast, t, title, workset],
  );

  const handleDelete = useCallback(async () => {
    if (!workset) return;
    setDeleteBusy(true);
    try {
      await deleteWorkset(workset.id);
      await refreshWorksets();
      showToast(t("workset:deletedToast", { name: title }), "success");
      setDeleteOpen(false);
      navigate(WORKSETS_PATH, { replace: true });
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setDeleteBusy(false);
    }
  }, [navigate, refreshWorksets, showToast, t, title, workset]);

  if (worksetsLoading && !workset) {
    return (
      <AppPageShell>
        <SkeletonScreen variant="card-grid" count={4} columns={3} />
      </AppPageShell>
    );
  }

  if (!workset) {
    return (
      <AppPageShell>
        <EmptyState
          illustration={<EmptyStateGlyph icon={Layers} />}
          title={t("workset:workspaceNotFoundTitle")}
          description={t("workset:workspaceNotFoundDescription")}
          actions={
            <Button variant="primary" onClick={goCatalog}>
              {t("workset:backToCatalog")}
            </Button>
          }
        />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell width="fluid" className="!min-h-0 justify-start">
      <OpsControlBar
        sticky
        ariaLabel={t("workset:toolbarAria")}
        data-testid="workset-workspace-toolbar"
        className="!flex-wrap"
      >
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={goCatalog}
          aria-label={t("workset:backToCatalogAria")}
          title={t("workset:backToCatalog")}
          data-testid="workset-workspace-back"
        >
          <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />
        </Button>
        <WorksetCatalogChrome />
        <div className="flex min-w-0 flex-1 items-center gap-sm">
          <h1 className={`min-w-0 truncate ${pageTitleClass}`}>{title}</h1>
          {isSystem ? (
            <Badge tone="info" className="shrink-0">
              {t("workset:systemBadge")}
            </Badge>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-sm">
          <WorksetPermissionToggles worksetId={workset.id} worksetName={title} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRenameOpen(true)}
            data-testid={isSystem ? "workset-workspace-edit" : "workset-workspace-rename"}
          >
            {isSystem ? t("workset:edit") : t("workset:rename")}
          </Button>
          {!isSystem ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              data-testid="workset-workspace-delete"
            >
              {t("workset:delete")}
            </Button>
          ) : null}
        </div>
      </OpsControlBar>

      {/* Full-width strip. Never max-w-xl: @theme --spacing-xl is 20px. */}
      <div
        className="mb-md w-full min-w-0 shrink-0 self-stretch"
        data-testid="workset-workspace-cover"
      >
        <WorksetCoverField
          worksetId={workset.id}
          cover={workset.cover ?? ""}
          name={title}
        />
      </div>

      <WorksetContentsPanel
        workset={{
          id: workset.id,
          title,
          isSystem,
          tasks: memberTasks,
        }}
      />

      <WorksetNameDialog
        open={renameOpen}
        mode="rename"
        initialName={workset.name}
        initialDescription={workset.description ?? ""}
        nameDisabled={isSystem}
        busy={renameBusy}
        onClose={() => {
          if (!renameBusy) setRenameOpen(false);
        }}
        onSubmit={handleSave}
      />

      {deleteOpen ? (
        <ConfirmDialog
          title={t("workset:deleteTitle")}
          body={t("workset:deleteConfirm", { name: title })}
          confirmLabel={t("dialog.confirmDelete")}
          confirmBusyLabel={t("dialog.deleting")}
          busy={deleteBusy}
          onCancel={() => {
            if (!deleteBusy) setDeleteOpen(false);
          }}
          onConfirm={handleDelete}
        />
      ) : null}
    </AppPageShell>
  );
}
