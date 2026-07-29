import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatAccountLabel } from "../../../utils/accountDisplay";
import { SourceTabLayout } from "../SourceTabLayout";
import { EmailMailboxDetailDialog } from "./EmailMailboxDetailDialog";
import { EmailEditDialog } from "./EmailEditDialog";
import { EmailMailboxCard } from "./EmailMailboxCard";
import { EmailMailboxForm } from "./EmailMailboxForm";
import { useEmailTab } from "./useEmailTab";

export function EmailTab() {
  const { t } = useTranslation("sources");
  const {
    mailboxes,
    initialLoading,
    isRefreshing,
    error,
    form,
    setForm,
    setPreset,
    submitting,
    formError,
    removeTarget,
    setRemoveTarget,
    removing,
    retrying,
    fetchMailboxes,
    handleRetry,
    handleAddMailbox,
    handleRemoveMailbox,
    editTarget,
    editForm,
    setEditForm,
    editResetCursors,
    setEditResetCursors,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  } = useEmailTab();
  const [detailTarget, setDetailTarget] = useState<(typeof mailboxes)[number] | null>(null);

  const addForm = (
    <EmailMailboxForm
      form={form}
      setForm={setForm}
      setPreset={setPreset}
      submitting={submitting}
      formError={formError}
      onSubmit={() => void handleAddMailbox().catch(() => {})}
    />
  );

  return (
    <>
      <SourceTabLayout
        error={error}
        retrying={retrying}
        onRetry={handleRetry}
        formTitle={t("email.formTitle")}
        formDescription={t("email.formDescription")}
        addForm={addForm}
        listTitle={t("email.listTitle")}
        itemCount={mailboxes.length}
        initialLoading={initialLoading}
        isRefreshing={isRefreshing}
        emptyState={{
          title: t("email.emptyTitle"),
          description: t("email.emptyDescription"),
          hint: t("email.emptyHint"),
        }}
        removeOpen={!!removeTarget}
        removeTitle={t("email.removeTitle")}
        removing={removing}
        removeMessage={
          removeTarget
            ? t("email.removeMessage", {
                name: formatAccountLabel(removeTarget.account) || removeTarget.username,
              })
            : null
        }
        onRemoveConfirm={() => void handleRemoveMailbox().catch(() => {})}
        onRemoveCancel={() => setRemoveTarget(null)}
      >
        {mailboxes.map((mailbox) => (
          <EmailMailboxCard
            key={mailbox.account.id}
            mailbox={mailbox}
            onRemoveClick={() => setRemoveTarget(mailbox)}
            onEditClick={() => openEditDialog(mailbox)}
            onSelectClick={() => setDetailTarget(mailbox)}
            onReconnectSuccess={() => void fetchMailboxes().catch(() => {})}
          />
        ))}
      </SourceTabLayout>

      {detailTarget ? (
        <EmailMailboxDetailDialog
          mailbox={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => {
            const target = detailTarget;
            setDetailTarget(null);
            openEditDialog(target);
          }}
        />
      ) : null}

      {editTarget && editForm && (
        <EmailEditDialog
          mailbox={editTarget}
          form={editForm}
          setForm={setEditForm}
          resetCursors={editResetCursors}
          setResetCursors={setEditResetCursors}
          submitting={editSubmitting}
          error={editError}
          onClose={closeEditDialog}
          onSave={() => void handleSaveEdit().catch(() => {})}
        />
      )}
    </>
  );
}
