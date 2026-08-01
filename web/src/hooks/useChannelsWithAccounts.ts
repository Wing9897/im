import { useCallback, useEffect } from "react";

import { listChannelsWithAccounts } from "../api/channels";
import type { ChannelWithAccount } from "../types";
import { useAsyncResource, type UseAsyncResourceOptions } from "./useAsyncResource";

interface UseChannelsWithAccountsResult {
  channels: ChannelWithAccount[];
  /** True after the first successful fetch (including an empty channel list). */
  loaded: boolean;
  initialLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const EMPTY_CHANNELS: ChannelWithAccount[] = [];

/**
 * Shared hook that fetches channels with their associated account info.
 * Consolidates the duplicate `listChannelsWithAccounts()` calls found in
 * useLeaderboardPage and other pages.
 *
 * Uses {@link useAsyncResource} for the standard fetch+loading+error pattern
 * with built-in stale-request guarding and toast-on-error support.
 */
export function useChannelsWithAccounts(
  options?: UseAsyncResourceOptions,
): UseChannelsWithAccountsResult {
  const fetcher = useCallback(
    () => listChannelsWithAccounts(),
    [],
  );

  const { data, initialLoading, error, execute } = useAsyncResource(fetcher, {
    toastOnError: true,
    ...options,
  });

  useEffect(() => {
    void execute(undefined);
  }, [execute]);

  const refresh = useCallback(() => {
    void execute(undefined);
  }, [execute]);

  return {
    channels: data ?? EMPTY_CHANNELS,
    loaded: data !== null,
    initialLoading,
    error,
    refresh,
  };
}
