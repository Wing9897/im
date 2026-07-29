import { useRetryAction } from "../../../hooks/useRetryAction";
import { useTranslation } from "react-i18next";
import { AccountListSection } from "../accounts/AccountListSection";
import { AddAccountForm } from "../accounts/AddAccountForm";
import { QrLoginDialog } from "../accounts/QrLoginDialog";
import { VerificationDialog } from "../accounts/AccountDialogs";
import { TelegramEditDialog } from "../accounts/TelegramEditDialog";
import { SourceTabLayout } from "../SourceTabLayout";
import { useTelegramAccounts } from "./useTelegramAccounts";

export function TelegramTab() {
  const { t } = useTranslation("sources");
  const {
    accounts,
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
    refreshingAllAccounts,
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
    handleAddAccount,
    handleSubmitCode,
    handleSubmit2fa,
    handleRemoveAccount,
    handleReconnect,
    handleRefreshAllAccounts,
    fetchAccounts,
  } = useTelegramAccounts();

  const { retrying, handleRetry } = useRetryAction(fetchAccounts);
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
          <AddAccountForm
            loginMethod={loginMethod}
            setLoginMethod={setLoginMethod}
            apiId={apiId}
            setApiId={setApiId}
            apiHash={apiHash}
            setApiHash={setApiHash}
            phone={phone}
            setPhone={setPhone}
            submitting={submitting}
            onSubmit={handleAddAccount}
          />
        }
        listTitle=""
        itemCount={accounts.length}
        initialLoading={initialLoading}
        isRefreshing={isRefreshing}
        emptyState={{ title: "", description: "" }}
        removeOpen={!!removeTarget}
        removeTitle={t("telegram.removeTitle")}
        removing={removing}
        removeMessage={t("telegram.removeMessage")}
        onRemoveConfirm={() => void handleRemoveAccount(removeTarget!).catch(() => {})}
        onRemoveCancel={() => setRemoveTarget(null)}
        listContent={
          <AccountListSection
            accounts={accounts}
            initialLoading={initialLoading}
            isRefreshing={isRefreshing}
            refreshingAllAccounts={refreshingAllAccounts}
            refreshAllNotice={refreshAllNotice}
            reconnecting={reconnecting}
            reconnectError={reconnectError}
            reconnectErrorTarget={reconnectErrorTarget}
            onRefreshAll={handleRefreshAllAccounts}
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
        <TelegramEditDialog
          account={editTarget}
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
