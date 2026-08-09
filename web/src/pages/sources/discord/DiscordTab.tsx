import { useTranslation } from "react-i18next";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { SourceTabLayout } from "../board/SourceTabLayout";
import { DiscordBotDetailDialog } from "./DiscordBotDetailDialog";
import { DiscordBotCard } from "./DiscordBotCard";
import { DiscordBotForm } from "./DiscordBotForm";
import { DiscordEditDialog } from "./DiscordEditDialog";
import { useDiscordTab } from "./useDiscordTab";
import { useSourceDetailTarget } from "../useSourceDetailTarget";

export function DiscordTab() {
  const { t } = useTranslation("sources");
  const {
    bots,
    initialLoading,
    isRefreshing,
    error,
    botToken,
    setBotToken,
    submitting,
    formError,
    removeTarget,
    setRemoveTarget,
    removing,
    retrying,
    fetchBots,
    handleRetry,
    handleAddBot,
    handleRemoveBot,
    editTarget,
    editName,
    setEditName,
    editToken,
    setEditToken,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  } = useDiscordTab();
  const { detailTarget, setDetailTarget, closeDetail } =
    useSourceDetailTarget<(typeof bots)[number]>();

  const addForm = (
    <DiscordBotForm
      botToken={botToken}
      setBotToken={setBotToken}
      submitting={submitting}
      formError={formError}
      onSubmit={() => void handleAddBot().catch(() => {})}
    />
  );

  return (
    <>
      <SourceTabLayout
      error={error}
      retrying={retrying}
      onRetry={handleRetry}
      formTitle={t("discord.formTitle")}
      formDescription={t("discord.formDescription")}
      addForm={addForm}
      listTitle={t("discord.listTitle")}
      itemCount={bots.length}
      initialLoading={initialLoading}
      isRefreshing={isRefreshing}
      emptyState={{
        title: t("discord.emptyTitle"),
        description: t("discord.emptyDescription"),
        hint: t("discord.emptyHint"),
      }}
      removeOpen={!!removeTarget}
      removeTitle={t("discord.removeTitle")}
      removing={removing}
      removeMessage={
        removeTarget
          ? t("discord.removeMessage", {
              name: formatSourceLabel(removeTarget.source) || "Discord Bot",
            })
          : null
      }
      onRemoveConfirm={() => void handleRemoveBot().catch(() => {})}
      onRemoveCancel={() => setRemoveTarget(null)}
    >
      {bots.map((bot) => (
        <DiscordBotCard
          key={bot.source.id}
          bot={bot}
          onRemoveClick={() => setRemoveTarget(bot)}
          onEditClick={() => openEditDialog(bot)}
          onSelectClick={() => setDetailTarget(bot)}
          onReconnectSuccess={() => void fetchBots().catch(() => {})}
        />
      ))}
    </SourceTabLayout>

      {detailTarget ? (
        <DiscordBotDetailDialog
          bot={detailTarget}
          onClose={closeDetail}
        />
      ) : null}

      {editTarget ? (
        <DiscordEditDialog
          bot={editTarget}
          name={editName}
          setName={setEditName}
          botToken={editToken}
          setBotToken={setEditToken}
          submitting={editSubmitting}
          error={editError}
          onClose={closeEditDialog}
          onSave={() => void handleSaveEdit().catch(() => {})}
        />
      ) : null}
    </>
  );
}
