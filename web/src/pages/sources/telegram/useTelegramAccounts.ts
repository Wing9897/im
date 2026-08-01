import { useCallback, useEffect, useState } from "react";
import {
  createTelegramAccount,
  createTelegramQrAccount,
  listTelegramAccounts,
  updateTelegramAccount,
  reconnectAccount,
  refreshAllAccounts,
  deleteAccount,
} from "../../../api/accounts";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import { useAsyncResource } from "../../../hooks/useAsyncResource";
import type { Account, AccountCredentials } from "../../../types";
import { toErrorMessage } from "../../../utils/errors";
import { formatAccountLabel } from "../../../utils/accountDisplay";
import {
  buildRefreshAllNotice,
  getVerificationStart,
} from "../accounts/accountsPageModel";
import type { TelegramLoginMethod } from "../accounts/AddAccountForm";
import i18n from "../../../i18n";
import { useTelegramVerification } from "./useTelegramVerification";

/**
 * Hook for managing Telegram account operations:
 * - Listing accounts
 * - Adding new accounts (with verification flow)
 * - Reconnecting disconnected accounts
 * - Refreshing all accounts
 * - Removing accounts
 */
export function useTelegramAccounts() {
  const { lastAccountStatusChange } = useAnalysisStatus();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add account form state
  const [loginMethod, setLoginMethod] = useState<TelegramLoginMethod>("phone");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Remove / reconnect state
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [reconnectErrorTarget, setReconnectErrorTarget] = useState<
    string | null
  >(null);
  const [refreshingAllAccounts, setRefreshingAllAccounts] = useState(false);
  const [refreshAllNotice, setRefreshAllNotice] = useState<string | null>(null);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const listFetcher = useCallback(() => listTelegramAccounts(), []);
  const {
    data: accountsPage,
    initialLoading,
    isRefreshing,
    error: fetchError,
    execute: executeFetchAccounts,
  } = useAsyncResource(listFetcher);

  useEffect(() => {
    if (accountsPage) setAccounts(accountsPage);
  }, [accountsPage]);

  const clearAddAccountForm = useCallback(() => {
    setApiId("");
    setApiHash("");
    setPhone("");
  }, []);

  const fetchAccounts = useCallback(async () => {
    setActionError(null);
    await executeFetchAccounts(undefined);
  }, [executeFetchAccounts]);

  // Verification sub-hook (code + 2FA flow)
  const {
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
    startVerification,
    closeVerifyDialog,
    handleSubmitCode,
    handleSubmit2fa,
  } = useTelegramVerification({ clearAddAccountForm, fetchAccounts });

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (!lastAccountStatusChange) {
      return;
    }
    const { accountId, status } = lastAccountStatusChange;
    setAccounts((prev) =>
      prev.map((account) =>
        account.id === accountId ? { ...account, status } : account,
      ),
    );
  }, [lastAccountStatusChange]);

  const handleAddAccount = async () => {
    if (!apiId || !apiHash) return;
    if (loginMethod === "phone" && !phone) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const resp =
        loginMethod === "qr"
          ? await createTelegramQrAccount({
              apiId: Number(apiId),
              apiHash,
            })
          : await createTelegramAccount({
              apiId: Number(apiId),
              apiHash,
              phone,
            } satisfies AccountCredentials);
      const verification = getVerificationStart(resp);

      if (verification) {
        startVerification(verification);
        await fetchAccounts();
      } else if (resp.nextStep === "connected") {
        clearAddAccountForm();
        await fetchAccounts();
      } else {
        setActionError(String(i18n.t("sources:telegram.connectFailed")));
        await fetchAccounts();
      }
    } catch (e) {
      setActionError(toErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAccount = async (id: string) => {
    setRemoving(true);
    try {
      await deleteAccount(id);
      setAccounts((prev) => prev.filter((account) => account.id !== id));
      setRemoveTarget(null);
    } catch (e) {
      setActionError(toErrorMessage(e));
    } finally {
      setRemoving(false);
    }
  };

  const handleReconnect = async (accountId: string) => {
    setReconnecting(accountId);
    setReconnectError(null);
    setReconnectErrorTarget(null);
    setRefreshAllNotice(null);
    try {
      const resp = await reconnectAccount(accountId);
      const verification = getVerificationStart(resp);
      if (resp.nextStep === "connected") {
        await fetchAccounts();
      } else if (verification) {
        startVerification(verification);
        await fetchAccounts();
      } else {
        setReconnectError(String(i18n.t("sources:telegram.reconnectSessionExpired")));
        setReconnectErrorTarget(accountId);
        await fetchAccounts();
      }
    } catch (e) {
      setReconnectError(toErrorMessage(e));
      setReconnectErrorTarget(accountId);
    } finally {
      setReconnecting(null);
    }
  };

  const handleRefreshAllAccounts = async () => {
    setRefreshingAllAccounts(true);
    setActionError(null);
    setReconnectError(null);
    setReconnectErrorTarget(null);
    setRefreshAllNotice(null);
    try {
      const summary = await refreshAllAccounts();
      await fetchAccounts();
      setRefreshAllNotice(buildRefreshAllNotice(summary));
    } catch (e) {
      setActionError(toErrorMessage(e));
    } finally {
      setRefreshingAllAccounts(false);
    }
  };

  const openEditDialog = useCallback((account: Account) => {
    setEditTarget(account);
    setEditName(formatAccountLabel(account));
    setEditError(null);
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditTarget(null);
    setEditName("");
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError(String(i18n.t("sources:telegram.displayNameRequired")));
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      await updateTelegramAccount(editTarget.id, { name: trimmed });
      closeEditDialog();
      await fetchAccounts();
    } catch (e) {
      setEditError(toErrorMessage(e));
    } finally {
      setEditSubmitting(false);
    }
  }, [editTarget, editName, closeEditDialog, fetchAccounts]);

  return {
    accounts,
    initialLoading,
    isRefreshing,
    error: actionError ?? fetchError,
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
  };
}
