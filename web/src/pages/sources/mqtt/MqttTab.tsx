import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SourceTabLayout } from "../SourceTabLayout";
import { MqttBrokerDetailDialog } from "./MqttBrokerDetailDialog";
import { MqttBrokerCard } from "./MqttBrokerCard";
import { MqttBrokerForm } from "./MqttBrokerForm";
import { MqttEditDialog } from "./mqttFormModel";
import { useMqttTab } from "./useMqttTab";

export function MqttTab() {
  const { t } = useTranslation("sources");
  const {
    accounts,
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
    fetchMqttAccounts,
    handleRetry,
    retrying,
    handleAddMqttAccount,
    handleRemoveMqttAccount,
    editTarget,
    editForm,
    setEditForm,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  } = useMqttTab();
  const [detailTarget, setDetailTarget] = useState<(typeof accounts)[number] | null>(null);

  const addForm = (
    <MqttBrokerForm
      brokerUrl={form.brokerUrl}
      setBrokerUrl={(v) => setForm((s) => ({ ...s, brokerUrl: v }))}
      topics={form.topics}
      setTopics={(v) => setForm((s) => ({ ...s, topics: v }))}
      username={form.username}
      setUsername={(v) => setForm((s) => ({ ...s, username: v }))}
      password={form.password}
      setPassword={(v) => setForm((s) => ({ ...s, password: v }))}
      clientId={form.clientId}
      setClientId={(v) => setForm((s) => ({ ...s, clientId: v }))}
      submitting={submitting}
      formError={formError}
      onSubmit={() => void handleAddMqttAccount().catch(() => {})}
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
        itemCount={accounts.length}
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
        onRemoveConfirm={() => void handleRemoveMqttAccount().catch(() => {})}
        onRemoveCancel={() => setRemoveTarget(null)}
      >
        {accounts.map((broker) => (
          <MqttBrokerCard
            key={broker.account.id}
            broker={broker}
            onEditClick={() => openEditDialog(broker)}
            onRemoveClick={() => setRemoveTarget(broker)}
            onSelectClick={() => setDetailTarget(broker)}
            onReconnectSuccess={() => void fetchMqttAccounts().catch(() => {})}
          />
        ))}
      </SourceTabLayout>

      {detailTarget ? (
        <MqttBrokerDetailDialog
          broker={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={() => {
            const target = detailTarget;
            setDetailTarget(null);
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
