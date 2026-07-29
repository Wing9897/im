import { useCallback, useEffect, useState } from "react";
import { listAccounts } from "../../api/accounts";
import { useChannelsWithAccounts } from "../../hooks/useChannelsWithAccounts";
import { usePersistedState } from "../../hooks/usePersistedState";
import { usePersistedMonitorViewMode } from "../../hooks/usePersistedMonitorViewMode";
import type { Account, MessageFilters } from "../../types";
import i18n from "../../i18n";
import { captureError } from "../../utils/errorReporter";
import { MONITOR_VIEW_MODE_STORAGE_KEY } from "../../domain/monitor/monitorViewMode";
import { MONITOR_FILTERS_STORAGE_KEY } from "../../domain/monitor/monitorPersistedKeys";
import { normalizeMonitorFilters } from "./monitorPageModel";

/**
 * Accounts / channels metadata, filters, and view-mode state for Monitor.
 */
export function useMonitorInitialLoad() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const {
    channels,
    loaded: channelsReady,
    error: channelsError,
    refresh: refreshChannels,
  } = useChannelsWithAccounts({ toastOnError: false });
  const [accountsReady, setAccountsReady] = useState(false);
  const [accountsLoadFailed, setAccountsLoadFailed] = useState(false);
  const [filters, setFilters] = usePersistedState<MessageFilters>(
    MONITOR_FILTERS_STORAGE_KEY,
    {},
  );
  const [viewMode, setViewMode] = usePersistedMonitorViewMode(MONITOR_VIEW_MODE_STORAGE_KEY);
  const streamEnabled = viewMode !== "wall";
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataRetryKey, setMetadataRetryKey] = useState(0);

  const retryMetadataLoad = useCallback(() => {
    setMetadataError(null);
    setAccountsLoadFailed(false);
    refreshChannels();
    setAccountsReady(false);
    setMetadataRetryKey((current) => current + 1);
  }, [refreshChannels]);

  useEffect(() => {
    if (channelsError) {
      captureError(new Error(channelsError), { component: "MonitorPage", severity: "error" });
    }
  }, [channelsError]);

  useEffect(() => {
    let cancelled = false;

    const loadAccounts = async () => {
      if (accountsReady) return;

      const accountsResult = await listAccounts().catch((e) => {
        captureError(e, { component: "MonitorPage", severity: "error" });
        return null;
      });
      if (cancelled) return;
      if (accountsResult !== null) {
        setAccounts(accountsResult);
        setAccountsReady(true);
        setAccountsLoadFailed(false);
      } else {
        setAccountsLoadFailed(true);
      }
    };

    void loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [accountsReady, metadataRetryKey]);

  useEffect(() => {
    if (channelsError || (viewMode !== "wall" && accountsLoadFailed && channelsReady)) {
      setMetadataError(String(i18n.t("monitor:metadata.loadError")));
      return;
    }
    if (!channelsReady) return;
    if (viewMode === "wall" || accountsReady) {
      setMetadataError(null);
    }
  }, [accountsLoadFailed, accountsReady, channelsError, channelsReady, viewMode]);

  useEffect(() => {
    if (!accountsReady || !channelsReady) return;
    const normalized = normalizeMonitorFilters(filters, accounts, channels);
    if (normalized.changed) setFilters(normalized.filters);
  }, [accounts, accountsReady, channels, channelsReady, filters, setFilters]);

  return {
    accounts,
    channels,
    channelsReady,
    accountsReady,
    filters,
    setFilters,
    viewMode,
    setViewMode,
    streamEnabled,
    metadataError,
    retryMetadataLoad,
  };
}
