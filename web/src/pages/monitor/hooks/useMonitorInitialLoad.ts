import { useCallback, useEffect, useState } from "react";
import { listSources } from "../../../api/sources";
import { useChannelsWithSources } from "../../../hooks/useChannelsWithSources";
import { usePersistedMonitorViewMode, usePersistedState } from "../../../hooks/usePersistedState";
import type { Source, MessageFilters } from "../../../types";
import i18n from "../../../i18n";
import { captureError } from "../../../utils/errorReporter";
import { MONITOR_VIEW_MODE_STORAGE_KEY } from "../../../domain/monitor/monitorViewMode";
import { MONITOR_FILTERS_STORAGE_KEY } from "../../../domain/prefs";
import { normalizeMonitorFilters } from "../monitorPageModel";

/**
 * Sources / channels metadata, filters, and view-mode state for Monitor.
 */
export function useMonitorInitialLoad() {
  const [sources, setSources] = useState<Source[]>([]);
  const {
    channels,
    loaded: channelsReady,
    error: channelsError,
    refresh: refreshChannels,
  } = useChannelsWithSources({ toastOnError: false });
  const [sourcesReady, setSourcesReady] = useState(false);
  const [sourcesLoadFailed, setSourcesLoadFailed] = useState(false);
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
    setSourcesLoadFailed(false);
    refreshChannels();
    setSourcesReady(false);
    setMetadataRetryKey((current) => current + 1);
  }, [refreshChannels]);

  useEffect(() => {
    if (channelsError) {
      captureError(new Error(channelsError), { component: "MonitorPage", severity: "error" });
    }
  }, [channelsError]);

  useEffect(() => {
    let cancelled = false;

    const loadSources = async () => {
      if (sourcesReady) return;

      const sourcesResult = await listSources().catch((e) => {
        captureError(e, { component: "MonitorPage", severity: "error" });
        return null;
      });
      if (cancelled) return;
      if (sourcesResult !== null) {
        setSources(sourcesResult);
        setSourcesReady(true);
        setSourcesLoadFailed(false);
      } else {
        setSourcesLoadFailed(true);
      }
    };

    void loadSources();
    return () => {
      cancelled = true;
    };
  }, [sourcesReady, metadataRetryKey]);

  useEffect(() => {
    if (channelsError || (viewMode !== "wall" && sourcesLoadFailed && channelsReady)) {
      setMetadataError(String(i18n.t("monitor:metadata.loadError")));
      return;
    }
    if (!channelsReady) return;
    if (viewMode === "wall" || sourcesReady) {
      setMetadataError(null);
    }
  }, [sourcesLoadFailed, sourcesReady, channelsError, channelsReady, viewMode]);

  useEffect(() => {
    if (!sourcesReady || !channelsReady) return;
    const normalized = normalizeMonitorFilters(filters, sources, channels);
    if (normalized.changed) setFilters(normalized.filters);
  }, [sources, sourcesReady, channels, channelsReady, filters, setFilters]);

  return {
    sources,
    channels,
    channelsReady,
    sourcesReady,
    filters,
    setFilters,
    viewMode,
    setViewMode,
    streamEnabled,
    metadataError,
    retryMetadataLoad,
  };
}
