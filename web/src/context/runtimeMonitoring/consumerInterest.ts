/**
 * Refcount for runtime monitoring consumers.
 * Interval polls skip work when nobody is subscribed (SSE still updates state).
 */

export type RuntimeInterestKind = "logs" | "queue" | "collector" | "ai";

const counts: Record<RuntimeInterestKind, number> = {
  logs: 0,
  queue: 0,
  collector: 0,
  ai: 0,
};

export function acquireRuntimeInterest(kind: RuntimeInterestKind): () => void {
  counts[kind] += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    counts[kind] = Math.max(0, counts[kind] - 1);
  };
}

export function hasRuntimeInterest(kind: RuntimeInterestKind): boolean {
  return counts[kind] > 0;
}

/** Test helper. */
export function resetRuntimeInterestForTests(): void {
  counts.logs = 0;
  counts.queue = 0;
  counts.collector = 0;
  counts.ai = 0;
}
