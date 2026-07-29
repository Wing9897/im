import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SourceTabLayout } from "../SourceTabLayout";
import { HttpSourceDetailDialog } from "./HttpSourceDetailDialog";
import { HttpSourceCard } from "./HttpSourceCard";
import { HttpSourceForm } from "./HttpSourceForm";
import { HttpEditDialog } from "./HttpEditDialog";
import { useHttpTab } from "./useHttpTab";
import { formatAccountLabel } from "../../../utils/accountDisplay";

export function HttpTab({ modeToggle }: { modeToggle?: ReactNode }) {
  const { t } = useTranslation("sources");
  const {
    sources,
    initialLoading,
    isRefreshing,
    error,
    form,
    setForm,
    submitting,
    formError,
    removeTarget,
    setRemoveTarget,
    removing,
    fetchHttpSources,
    handleRetry,
    retrying,
    handleAddHttpSource,
    handleRemoveHttpSource,
    editTarget,
    editForm,
    setEditForm,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  } = useHttpTab();
  const [detailTarget, setDetailTarget] = useState<(typeof sources)[number] | null>(null);

  const addForm = (
    <HttpSourceForm
      fields={form}
      setFields={setForm}
      submitting={submitting}
      formError={formError}
      onSubmit={() => void handleAddHttpSource().catch(() => {})}
    />
  );

  return (
    <>
      <SourceTabLayout
        error={error}
        retrying={retrying}
        onRetry={handleRetry}
        formTitle={t("http.formTitle")}
        formDescription={t("http.formDescription")}
        addForm={addForm}
        listTitle={t("http.listTitle")}
        listHeaderActions={modeToggle}
        itemCount={sources.length}
        initialLoading={initialLoading}
        isRefreshing={isRefreshing}
        emptyState={{
          title: t("http.emptyTitle"),
          description: t("http.emptyDescription"),
          hint: t("http.emptyHint"),
        }}
        removeOpen={!!removeTarget}
        removeTitle={t("http.removeTitle")}
        removing={removing}
        removeMessage={
          removeTarget
            ? t("http.removeMessage", {
                name: formatAccountLabel(removeTarget.account) || removeTarget.url,
              })
            : null
        }
        onRemoveConfirm={() => void handleRemoveHttpSource().catch(() => {})}
        onRemoveCancel={() => setRemoveTarget(null)}
      >
        {sources.map((source) => (
          <HttpSourceCard
            key={source.account.id}
            source={source}
            onEditClick={() => openEditDialog(source)}
            onRemoveClick={() => setRemoveTarget(source)}
            onSelectClick={() => setDetailTarget(source)}
            onReconnectSuccess={() => void fetchHttpSources().catch(() => {})}
          />
        ))}
      </SourceTabLayout>

      {detailTarget ? (
        <HttpSourceDetailDialog
          source={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => {
            const target = detailTarget;
            setDetailTarget(null);
            openEditDialog(target);
          }}
        />
      ) : null}

      {editTarget && editForm ? (
        <HttpEditDialog
          source={editTarget}
          form={editForm}
          setForm={(updater) =>
            setEditForm((current) => {
              if (!current) return current;
              return typeof updater === "function" ? updater(current) : updater;
            })
          }
          submitting={editSubmitting}
          error={editError}
          onClose={closeEditDialog}
          onSave={() => void handleSaveEdit()}
        />
      ) : null}
    </>
  );
}
