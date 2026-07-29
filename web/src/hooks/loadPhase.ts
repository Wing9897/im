/** Derives UI load phases when cached data lives outside useAsyncResource. */
export function loadPhase(rawLoading: boolean, hasData: boolean) {
  return {
    initialLoading: rawLoading && !hasData,
    isRefreshing: rawLoading && hasData,
  };
}
