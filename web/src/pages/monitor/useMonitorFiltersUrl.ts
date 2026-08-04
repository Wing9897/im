import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { MessageFilters, MessageTimeRange } from "../../types";
import { MESSAGE_TIME_RANGE_VALUES } from "../../domain/messages/messageTimeRange";
import { useDeepLinkFingerprint } from "../../hooks/useDeepLinkFingerprint";
import { useReplaceSearchParams } from "../../hooks/useReplaceSearchParams";

/** Full {@link MessageTimeRange} set (task windows + monitor-only ``12h``／``24h``). */
const TIME_RANGES = new Set<string>(MESSAGE_TIME_RANGE_VALUES);

function parseCsv(value: string | null): string[] | undefined {
  if (!value?.trim()) return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function serializeCsv(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  return values.join(",");
}

export function parseMonitorFiltersFromSearchParams(
  params: URLSearchParams,
): MessageFilters | null {
  const hasAny =
    params.has("q") ||
    params.has("platform") ||
    params.has("time") ||
    params.has("accounts") ||
    params.has("channels");
  if (!hasAny) return null;

  const time = params.get("time");
  const filters: MessageFilters = {};
  const q = params.get("q");
  if (q != null && q.trim()) filters.search = q;
  const platform = params.get("platform");
  if (platform?.trim()) filters.platform = platform.trim();
  if (time && TIME_RANGES.has(time)) filters.timeRange = time as MessageTimeRange;
  const accounts = parseCsv(params.get("accounts"));
  if (accounts) filters.accountIds = accounts;
  const channels = parseCsv(params.get("channels"));
  if (channels) filters.channelIds = channels;
  return filters;
}

export function writeMonitorFiltersToSearchParams(
  params: URLSearchParams,
  filters: MessageFilters,
): void {
  const search = filters.search?.trim();
  if (search) params.set("q", search);
  else params.delete("q");

  if (filters.platform) params.set("platform", filters.platform);
  else params.delete("platform");

  if (filters.timeRange) params.set("time", filters.timeRange);
  else params.delete("time");

  const accounts = serializeCsv(filters.accountIds);
  if (accounts) params.set("accounts", accounts);
  else params.delete("accounts");

  const channels = serializeCsv(filters.channelIds);
  if (channels) params.set("channels", channels);
  else params.delete("channels");
}

export function serializeMessageFilters(filters: MessageFilters): string {
  const params = new URLSearchParams();
  writeMonitorFiltersToSearchParams(params, filters);
  return params.toString();
}

interface UseMonitorFiltersUrlOptions {
  filters: MessageFilters;
  setFilters: (filters: MessageFilters) => void;
}

/**
 * Syncs monitor filters with URL query params:
 * `?q=&platform=&time=&accounts=&channels=`
 * Preserves unrelated keys such as `id`.
 * Re-applies per `location.key` fingerprint so keep-mount second deep-links work.
 */
export function useMonitorFiltersUrl({
  filters,
  setFilters,
}: UseMonitorFiltersUrlOptions) {
  const location = useLocation();
  const replaceParams = useReplaceSearchParams();
  const deepLinkGate = useDeepLinkFingerprint();
  /** True after the first hydrate pass so state→URL sync may run. */
  const hydratedRef = useRef(false);
  /** Skip one sync tick after URL hydrate so we don't write stale localStorage filters. */
  const skipSyncRef = useRef(false);
  const expectedAfterHydrateRef = useRef<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const fromUrl = parseMonitorFiltersFromSearchParams(searchParams);
    if (!fromUrl) {
      // No pending signal — allow a future filter deep-link to apply.
      deepLinkGate(location.key, null);
      hydratedRef.current = true;
      return;
    }

    const payload = serializeMessageFilters(fromUrl);
    if (deepLinkGate(location.key, payload) === "skip") {
      hydratedRef.current = true;
      return;
    }

    // Already in sync with URL (e.g. our own state→URL write) — do not re-apply.
    if (serializeMessageFilters(filtersRef.current) === payload) {
      hydratedRef.current = true;
      return;
    }

    expectedAfterHydrateRef.current = payload;
    skipSyncRef.current = true;
    setFilters(fromUrl);
    hydratedRef.current = true;
  }, [deepLinkGate, location.key, location.search, setFilters]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    if (skipSyncRef.current) {
      const current = serializeMessageFilters(filters);
      if (
        expectedAfterHydrateRef.current != null &&
        current !== expectedAfterHydrateRef.current
      ) {
        // Waiting for setFilters(fromUrl) to commit.
        return;
      }
      skipSyncRef.current = false;
      expectedAfterHydrateRef.current = null;
    }

    replaceParams((params) => {
      writeMonitorFiltersToSearchParams(params, filters);
    });
  }, [filters, replaceParams]);
}
