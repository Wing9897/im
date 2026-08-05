import { useTranslation } from "react-i18next";
import { SourceTabLayout } from "../SourceTabLayout";
import { MqttBrokerDetailDialog } from "./MqttBrokerDetailDialog";
import { MqttBrokerCard } from "./MqttBrokerCard";
import { MqttBrokerForm } from "./MqttBrokerForm";
import { MqttEditDialog } from "./mqttFormModel";
import { useMqttTab } from "./useMqttTab";
import { useSourceDetailTarget } from "../useSourceDetailTarget";

export function MqttTab() {
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
    fetchMqttSources,
    handleRetry,
    retrying,
    handleAddMqttSource,
    handleRemoveMqttSource,
    editTarget,
    editForm,
    setEditForm,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  } = useMqttTab();
  const { detailTarget, setDetailTarget, closeDetail } =
    useSourceDetailTarget<(typeof sources)[number]>();

  const addForm = (
    <MqttBrokerForm
      form={form}
      setForm={setForm}
      submitting={submitting}
      formError={formError}
      onSubmit={() => void handleAddMqttSource().catch(() => {})}
    />
  );

  return (
    <>
      <SourceTabLayout
        error={error}
        retrying={retrying}
        onRetry={handleRetry}
        formTitle={t("mqtt.formTitle")}
        formDescription={t("mqtt.formDescription")}
        addForm={addForm}
        listTitle={t("mqtt.listTitle")}
        itemCount={sources.length}
        initialLoading={initialLoading}
        isRefreshing={isRefreshing}
        emptyState={{
          title: t("mqtt.emptyTitle"),
          description: t("mqtt.emptyDescription"),
          hint: t("mqtt.emptyHint"),
        }}
        removeOpen={!!removeTarget}
        removeTitle={t("mqtt.removeTitle")}
        removing={removing}
        removeMessage={
          removeTarget ? t("mqtt.removeMessage", { name: removeTarget.brokerUrl }) : null
        }
        onRemoveConfirm={() => void handleRemoveMqttSource().catch(() => {})}
        onRemoveCancel={() => setRemoveTarget(null)}
      >
        {sources.map((broker) => (
          <MqttBrokerCard
            key={broker.source.id}
            broker={broker}
            onEditClick={() => openEditDialog(broker)}
            onRemoveClick={() => setRemoveTarget(broker)}
            onSelectClick={() => setDetailTarget(broker)}
            onReconnectSuccess={() => void fetchMqttSources().catch(() => {})}
          />
        ))}
      </SourceTabLayout>

      {detailTarget ? (
        <MqttBrokerDetailDialog
          broker={detailTarget}
          onClose={closeDetail}
          onEdit={() => {
            const target = detailTarget;
            closeDetail();
            openEditDialog(target);
          }}
        />
      ) : null}

      {editTarget && editForm && (
        <MqttEditDialog
          broker={editTarget}
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
      )}
    </>
  );
}
