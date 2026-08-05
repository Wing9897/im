import { useCallback, useEffect, useState } from "react";
import {
  createTelegramSource,
  createTelegramQrSource,
  listTelegramSources,
  updateTelegramSource,
  reconnectSource,
  refreshAllSources,
  deleteSource,
} from "../../../api/sources";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import { useAsyncResource } from "../../../hooks/useAsyncResource";
import type { Source, SourceCredentials } from "../../../types";
import { toErrorMessage } from "../../../utils/errors";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import {
  buildRefreshAllNotice,
  getVerificationStart,
} from "./telegramSourcePageModel";
import type { TelegramLoginMethod } from "./AddTelegramSourceForm";
import i18n from "../../../i18n";
import { useTelegramVerification } from "./useTelegramVerification";

/**
 * Hook for managing Telegram source operations:
 * - Listing sources
 * - Adding new sources (with verification flow)
 * - Reconnecting disconnected sources
 * - Refreshing all sources
 * - Removing sources
 */
export function useTelegramSources() {
  const { lastSourceStatusChange } = useAnalysisStatus();
  const [sources, setSources] = useState<Source[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add source form state
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
  const [refreshingAllSources, setRefreshingAllSources] = useState(false);
  const [refreshAllNotice, setRefreshAllNotice] = useState<string | null>(null);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<Source | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const listFetcher = useCallback(() => listTelegramSources(), []);
  const {
    data: sourcesPage,
    initialLoading,
    isRefreshing,
    error: fetchError,
    execute: executeFetchSources,
  } = useAsyncResource(listFetcher);

  useEffect(() => {
    if (sourcesPage) setSources(sourcesPage);
  }, [sourcesPage]);

  const clearAddTelegramSourceForm = useCallback(() => {
    setApiId("");
    setApiHash("");
    setPhone("");
  }, []);

  const fetchSources = useCallback(async () => {
    setActionError(null);
    await executeFetchSources(undefined);
  }, [executeFetchSources]);

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
  } = useTelegramVerification({ clearAddTelegramSourceForm, fetchSources });

  useEffect(() => {
    void fetchSources();
  }, [fetchSources]);

  useEffect(() => {
    if (!lastSourceStatusChange) {
      return;
    }
    const { sourceId, status } = lastSourceStatusChange;
    setSources((prev) =>
      prev.map((source) =>
        source.id === sourceId ? { ...source, status } : source,
      ),
    );
  }, [lastSourceStatusChange]);

  const handleAddSource = async () => {
    if (!apiId || !apiHash) return;
    if (loginMethod === "phone" && !phone) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const resp =
        loginMethod === "qr"
          ? await createTelegramQrSource({
              apiId: Number(apiId),
              apiHash,
            })
          : await createTelegramSource({
              apiId: Number(apiId),
              apiHash,
              phone,
            } satisfies SourceCredentials);
      const verification = getVerificationStart(resp);

      if (verification) {
        startVerification(verification);
        await fetchSources();
      } else if (resp.nextStep === "connected") {
        clearAddTelegramSourceForm();
        await fetchSources();
      } else {
        setActionError(String(i18n.t("sources:telegram.connectFailed")));
        await fetchSources();
      }
    } catch (e) {
      setActionError(toErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSource = async (id: string) => {
    setRemoving(true);
    try {
      await deleteSource(id);
      setSources((prev) => prev.filter((source) => source.id !== id));
      setRemoveTarget(null);
    } catch (e) {
      setActionError(toErrorMessage(e));
    } finally {
      setRemoving(false);
    }
  };

  const handleReconnect = async (sourceId: string) => {
    setReconnecting(sourceId);
    setReconnectError(null);
    setReconnectErrorTarget(null);
    setRefreshAllNotice(null);
    try {
      const resp = await reconnectSource(sourceId);
      const verification = getVerificationStart(resp);
      if (resp.nextStep === "connected") {
        await fetchSources();
      } else if (verification) {
        startVerification(verification);
        await fetchSources();
      } else {
        setReconnectError(String(i18n.t("sources:telegram.reconnectSessionExpired")));
        setReconnectErrorTarget(sourceId);
        await fetchSources();
      }
    } catch (e) {
      setReconnectError(toErrorMessage(e));
      setReconnectErrorTarget(sourceId);
    } finally {
      setReconnecting(null);
    }
  };

  const handleRefreshAllSources = async () => {
    setRefreshingAllSources(true);
    setActionError(null);
    setReconnectError(null);
    setReconnectErrorTarget(null);
    setRefreshAllNotice(null);
    try {
      const summary = await refreshAllSources();
      await fetchSources();
      setRefreshAllNotice(buildRefreshAllNotice(summary));
    } catch (e) {
      setActionError(toErrorMessage(e));
    } finally {
      setRefreshingAllSources(false);
    }
  };

  const openEditDialog = useCallback((source: Source) => {
    setEditTarget(source);
    setEditName(formatSourceLabel(source));
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
      await updateTelegramSource(editTarget.id, { name: trimmed });
      closeEditDialog();
      await fetchSources();
    } catch (e) {
      setEditError(toErrorMessage(e));
    } finally {
      setEditSubmitting(false);
    }
  }, [editTarget, editName, closeEditDialog, fetchSources]);

  return {
    sources,
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
  };
}
