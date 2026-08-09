import { useTranslation } from "react-i18next";
import { FormStack } from "../../../components/ui";
import { SourceTabLayout } from "../board/SourceTabLayout";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { RssFeedDetailDialog } from "./RssFeedDetailDialog";
import { RssFeedCard } from "./RssFeedCard";
import { RssProviderPicker } from "./providers/RssProviderPicker";
import { useRssTab } from "./useRssTab";
import { useSourceDetailTarget } from "../useSourceDetailTarget";

export function RssTab() {
  const { t } = useTranslation("sources");
  const {
    feeds,
    providers,
    activeProviderId,
    activeProvider,
    handleProviderChange,
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
    retrying,
    fetchFeeds,
    handleRetry,
    handleAddFeed,
    handleRemoveFeed,
    editTarget,
    editForm,
    setEditForm,
    editProvider,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  } = useRssTab();
  const { detailTarget, setDetailTarget, closeDetail } =
    useSourceDetailTarget<(typeof feeds)[number]>();

  const AddForm = activeProvider.AddForm;

  const addForm = (
    <FormStack className="min-h-0 flex-1">
      <RssProviderPicker
        providers={providers}
        activeId={activeProviderId}
        onChange={handleProviderChange}
        disabled={submitting}
      />
      <AddForm
        fields={form}
        setFields={setForm}
        submitting={submitting}
        formError={formError}
        onSubmit={() => void handleAddFeed().catch(() => {})}
      />
    </FormStack>
  );

  const EditDialog = editProvider?.EditDialog;

  return (
    <>
      <SourceTabLayout
        error={error}
        retrying={retrying}
        onRetry={handleRetry}
        formTitle={t(activeProvider.formTitleKey)}
        formDescription={t(activeProvider.formDescriptionKey)}
        addForm={addForm}
        listTitle={t("rss.listTitle")}
        itemCount={feeds.length}
        initialLoading={initialLoading}
        isRefreshing={isRefreshing}
        emptyState={{
          title: t("rss.emptyTitle"),
          description: t("rss.emptyDescription"),
          hint: t(activeProvider.emptyHintKey),
        }}
        removeOpen={!!removeTarget}
        removeTitle={t("rss.removeTitle")}
        removing={removing}
        removeMessage={
          removeTarget
            ? t("rss.removeMessage", {
                name: formatSourceLabel(removeTarget.source) || removeTarget.feedUrl,
              })
            : null
        }
        onRemoveConfirm={() => void handleRemoveFeed().catch(() => {})}
        onRemoveCancel={() => setRemoveTarget(null)}
      >
        {feeds.map((feed) => (
          <RssFeedCard
            key={feed.source.id}
            feed={feed}
            onEditClick={() => openEditDialog(feed)}
            onRemoveClick={() => setRemoveTarget(feed)}
            onSelectClick={() => setDetailTarget(feed)}
            onReconnectSuccess={() => void fetchFeeds().catch(() => {})}
          />
        ))}
      </SourceTabLayout>

      {detailTarget ? (
        <RssFeedDetailDialog
          feed={detailTarget}
          onClose={closeDetail}
          onEdit={() => {
            const target = detailTarget;
            closeDetail();
            openEditDialog(target);
          }}
        />
      ) : null}

      {editTarget && editForm && EditDialog ? (
        <EditDialog
          feed={editTarget}
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
