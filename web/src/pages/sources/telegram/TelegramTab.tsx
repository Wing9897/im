import { useRetryAction } from "../../../hooks/useRetryAction";
import { useTranslation } from "react-i18next";
import { TelegramSourceListSection } from "./TelegramSourceListSection";
import { AddTelegramSourceForm } from "./AddTelegramSourceForm";
import { QrLoginDialog } from "./QrLoginDialog";
import { VerificationDialog } from "./TelegramSourceDialogs";
import { TelegramSourceEditDialog } from "./TelegramSourceEditDialog";
import { SourceTabLayout } from "../board/SourceTabLayout";
import { useTelegramSources } from "./useTelegramSources";

export function TelegramTab() {
  const { t } = useTranslation("sources");
  const {
    sources,
    initialLoading,
    isRefreshing,
    error,
    loginMethod,
    setLoginMethod,
    apiId,
    setApiId,
    apiHash,
    setApiHash,
    phone,
    setPhone,
    submitting,
    verifyStep,
    verifyCode,
    setVerifyCode,
    verifyPassword,
    setVerifyPassword,
    verifyError,
    verifySubmitting,
    qrUrl,
    qrExpiresAt,
    qrWaiting,
    removeTarget,
    setRemoveTarget,
    removing,
    reconnecting,
    reconnectError,
    reconnectErrorTarget,
    refreshingAllSources,
    refreshAllNotice,
    editTarget,
    editName,
    setEditName,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
    closeVerifyDialog,
    handleAddSource,
    handleSubmitCode,
    handleSubmit2fa,
    handleRemoveSource,
    handleReconnect,
    handleRefreshAllSources,
    fetchSources,
  } = useTelegramSources();

  const { retrying, handleRetry } = useRetryAction(fetchSources);
  const showCodeOr2fa =
    verifyStep === "code_required" || verifyStep === "2fa_required";

  return (
    <>
      <SourceTabLayout
        error={error}
        retrying={retrying}
        onRetry={handleRetry}
        formTitle={t("telegram.formTitle")}
        formDescription={t("telegram.formDescription")}
        addForm={
          <AddTelegramSourceForm
            loginMethod={loginMethod}
            setLoginMethod={setLoginMethod}
            apiId={apiId}
            setApiId={setApiId}
            apiHash={apiHash}
            setApiHash={setApiHash}
            phone={phone}
            setPhone={setPhone}
            submitting={submitting}
            onSubmit={handleAddSource}
          />
        }
        listTitle=""
        itemCount={sources.length}
        initialLoading={initialLoading}
        isRefreshing={isRefreshing}
        emptyState={{ title: "", description: "" }}
        removeOpen={!!removeTarget}
        removeTitle={t("telegram.removeTitle")}
        removing={removing}
        removeMessage={t("telegram.removeMessage")}
        onRemoveConfirm={() => void handleRemoveSource(removeTarget!).catch(() => {})}
        onRemoveCancel={() => setRemoveTarget(null)}
        listContent={
          <TelegramSourceListSection
            sources={sources}
            initialLoading={initialLoading}
            isRefreshing={isRefreshing}
            refreshingAllSources={refreshingAllSources}
            refreshAllNotice={refreshAllNotice}
            reconnecting={reconnecting}
            reconnectError={reconnectError}
            reconnectErrorTarget={reconnectErrorTarget}
            onRefreshAll={handleRefreshAllSources}
            onReconnect={handleReconnect}
            onRemoveClick={setRemoveTarget}
            onEditClick={openEditDialog}
          />
        }
      >
        {null}
      </SourceTabLayout>

      {verifyStep === "qr_required" ? (
        <QrLoginDialog
          qrUrl={qrUrl}
          qrExpiresAt={qrExpiresAt}
          waiting={qrWaiting}
          error={verifyError}
          onClose={closeVerifyDialog}
        />
      ) : null}

      {showCodeOr2fa ? (
        <VerificationDialog
          step={verifyStep}
          verifyCode={verifyCode}
          setVerifyCode={setVerifyCode}
          verifyPassword={verifyPassword}
          setVerifyPassword={setVerifyPassword}
          verifyError={verifyError}
          verifySubmitting={verifySubmitting}
          onClose={closeVerifyDialog}
          onSubmitCode={handleSubmitCode}
          onSubmit2fa={handleSubmit2fa}
        />
      ) : null}

      {editTarget ? (
        <TelegramSourceEditDialog
          source={editTarget}
          name={editName}
          setName={setEditName}
          submitting={editSubmitting}
          error={editError}
          onClose={closeEditDialog}
          onSave={() => void handleSaveEdit().catch(() => {})}
        />
      ) : null}
    </>
  );
}
