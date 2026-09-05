/**
 * In-flight promise coalescing: concurrent callers with the same key share one
 * promise. Completed results are not cached (callers own TTL / SWR).
 */

const inflight = new Map<string, Promise<unknown>>();

export function coalesceAsync<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = factory().finally(() => {
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  });
  inflight.set(key, promise);
  return promise;
}

/** Test helper — clears the in-flight map between cases. Production builds drop the body. */
export function resetCoalesceAsyncForTests(): void {
  inflight.clear();
}
