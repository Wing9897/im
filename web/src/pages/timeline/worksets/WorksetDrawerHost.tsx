import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { createWorkset, deleteWorkset, updateWorkset } from "../../../api/worksets";
import { ModalDialog } from "../../../components/ModalDialog";
import { WorksetCoverField } from "../../../components/WorksetCoverField";
import { WorksetPermissionToggles } from "../../../components/WorksetPermissionToggles";
import { ConfirmDialog } from "../../../components/dialogs/ConfirmDialog";
import { WorksetNameDialog } from "../../../components/dialogs/WorksetNameDialog";
import { Button } from "../../../components/ui";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { useToast } from "../../../context/ToastContext";
import { useCalendarShareCatalog } from "../../../domain/calendarShare/useCalendarShareCatalog";
import type { AnalysisTask } from "../../../types/tasks";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { toError } from "../../../utils/errors";
import { CalendarSharePublishForm } from "../subscriptions/CalendarSharePublishForm";
import { SubscriptionsIdentityLogin } from "../subscriptions/SubscriptionsIdentityLogin";
import { useSubscriptionsIdentity } from "../subscriptions/useSubscriptionsIdentity";
import { WorksetContentsPanel } from "./WorksetContentsPanel";

/** App-level workset drawer (`?workset=list` or `?workset=<id>`). */
export function WorksetDrawerHost() {
  const [searchParams, setSearchParams] = useSearchParams();
  const worksetParam = searchParams.get("workset");
  if (!worksetParam) return null;
  return (
    <WorksetDrawer
      worksetParam={worksetParam}
      onOpen={(id) => {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set("workset", id);
            return next;
          },
          { replace: true },
        );
      }}
      onClose={() => {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("workset");
            return next;
          },
          { replace: true },
        );
      }}
    />
  );
}

function WorksetDrawer({
  worksetParam,
  onOpen,
  onClose,
}: {
  worksetParam: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(["workset", "common"]);
  const { showToast } = useToast();
  const { worksets, tasks, refreshWorksets } = useTaskCatalog();
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const isList = worksetParam === "list";
  const workset = useMemo(
    () => (isList ? null : worksets.find((row) => row.id === worksetParam) ?? null),
    [isList, worksetParam, worksets],
  );
  const title = !workset
    ? ""
    : workset.id === SYSTEM_WORKSET_ID
      ? t("generalName")
      : workset.name;
  const isSystem = Boolean(workset?.isSystem) || workset?.id === SYSTEM_WORKSET_ID;
  const memberTasks = useMemo(
    () => tasks.filter((task) => task.worksetId === workset?.id),
    [tasks, workset?.id],
  );

  const onCreate = async (values: { name: string; description: string; cover: string }) => {
    setCreateBusy(true);
    try {
      const created = await createWorkset(values.name.trim(), {
        description: values.description,
        ...(values.cover.trim() ? { cover: values.cover.trim() } : {}),
      });
      await refreshWorksets();
      showToast(t("createdToast", { name: created.name }), "success");
      setCreateOpen(false);
      onOpen(created.id);
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <>
      <ModalDialog
        open
        title={isList ? t("label") : title || t("label")}
        closeAriaLabel={t("common:dialog.close")}
        onClose={onClose}
        testId="workset-drawer"
        size="form"
        footer={
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("common:dialog.cancel")}
          </Button>
        }
      >
        {isList ? (
          <div className="flex min-w-0 flex-col gap-md" data-testid="workset-drawer-list">
            <div className="flex items-center justify-between gap-sm">
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-testid="workset-drawer-create"
                onClick={() => setCreateOpen(true)}
              >
                {t("create")}
              </Button>
            </div>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {worksets.map((row) => {
                const name = row.id === SYSTEM_WORKSET_ID ? t("generalName") : row.name;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-overlay)_35%,transparent)] px-md py-2.5 text-left text-body text-text-primary transition-colors hover:border-surface-border hover:bg-[color-mix(in_srgb,var(--surface-overlay)_75%,transparent)]"
                      data-testid={`workset-drawer-open-${row.id}`}
                      onClick={() => onOpen(row.id)}
                    >
                      <span className="min-w-0 truncate font-medium">{name}</span>
                      {row.description ? (
                        <span className="max-w-[45%] truncate text-caption text-text-muted">
                          {row.description}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : workset ? (
          <WorksetDrawerDetail
            workset={workset}
            title={title}
            isSystem={isSystem}
            memberTasks={memberTasks}
            onBack={() => onOpen("list")}
            onDeleted={async () => {
              await refreshWorksets();
              onOpen("list");
            }}
          />
        ) : (
          <p data-testid="workset-drawer-missing">{t("workspaceNotFoundTitle")}</p>
        )}
      </ModalDialog>
      <WorksetNameDialog
        open={createOpen}
        mode="create"
        busy={createBusy}
        onClose={() => {
          if (!createBusy) setCreateOpen(false);
        }}
        onSubmit={(values) => {
          void onCreate(values);
        }}
      />
    </>
  );
}

function WorksetDrawerDetail({
  workset,
  title,
  isSystem,
  memberTasks,
  onBack,
  onDeleted,
}: {
  workset: { id: string; name: string; description?: string; cover?: string };
  title: string;
  isSystem: boolean;
  memberTasks: AnalysisTask[];
  onBack: () => void;
  onDeleted: () => Promise<void>;
}) {
  const { t } = useTranslation(["workset", "common"]);
  const { showToast } = useToast();
  const { refreshWorksets } = useTaskCatalog();
  const catalog = useCalendarShareCatalog();
  const identity = useSubscriptionsIdentity();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const onRename = async (values: { name: string; description: string; cover: string }) => {
    setRenameBusy(true);
    try {
      await updateWorkset(workset.id, {
        ...(isSystem ? {} : { name: values.name.trim() }),
        description: values.description,
      });
      await refreshWorksets();
      showToast(t(isSystem ? "updatedToast" : "renamedToast", { name: values.name.trim() || title }), "success");
      setRenameOpen(false);
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setRenameBusy(false);
    }
  };

  const onDelete = async () => {
    setDeleteBusy(true);
    try {
      await deleteWorkset(workset.id);
      showToast(t("deletedToast", { name: title }), "success");
      setDeleteOpen(false);
      await onDeleted();
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-md" data-testid="workset-drawer-detail">
      <div className="flex flex-wrap items-center gap-sm">
        <Button type="button" variant="ghost" size="sm" data-testid="workset-drawer-back" onClick={onBack}>
          {t("backToCatalog")}
        </Button>
        <WorksetPermissionToggles worksetId={workset.id} worksetName={title} />
        <Button type="button" variant="secondary" size="sm" onClick={() => setRenameOpen(true)}>
          {isSystem ? t("edit") : t("rename")}
        </Button>
        {isSystem ? null : (
          <Button type="button" variant="secondary" size="sm" data-testid="workset-drawer-delete" onClick={() => setDeleteOpen(true)}>
            {t("delete")}
          </Button>
        )}
      </div>
      <WorksetCoverField worksetId={workset.id} cover={workset.cover ?? ""} name={title} />
      <WorksetContentsPanel
        workset={{
          id: workset.id,
          title,
          isSystem,
          tasks: memberTasks,
        }}
      />
      {catalog.loading && !catalog.session?.connected ? null : catalog.session?.connected ? (
        <CalendarSharePublishForm
          worksetId={workset.id}
          worksetTitle={title}
          isSystem={isSystem}
          worksetCover={workset.cover ?? ""}
          worksetDescription={workset.description ?? ""}
        />
      ) : (
        <SubscriptionsIdentityLogin identity={identity} />
      )}
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
        onSubmit={(values) => {
          void onRename(values);
        }}
      />
      {deleteOpen ? (
        <ConfirmDialog
          title={t("deleteTitle")}
          body={t("deleteConfirm", { name: title })}
          confirmLabel={t("common:dialog.confirmDelete")}
          confirmBusyLabel={t("common:dialog.deleting")}
          busy={deleteBusy}
          onCancel={() => {
            if (!deleteBusy) setDeleteOpen(false);
          }}
          onConfirm={() => {
            void onDelete();
          }}
        />
      ) : null}
    </div>
  );
}
