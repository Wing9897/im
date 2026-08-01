/**
 * Shared board poll bus: one timer per intervalMs across widgets.
 * Subscribers still run their own fetchers; the bus only coalesces ticks.
 */

type TickHandler = () => void;

interface BusBucket {
  intervalMs: number;
  timer: number | null;
  subscribers: Map<symbol, TickHandler>;
}

const buckets = new Map<number, BusBucket>();

function ensureBucket(intervalMs: number): BusBucket {
  let bucket = buckets.get(intervalMs);
  if (!bucket) {
    bucket = { intervalMs, timer: null, subscribers: new Map() };
    buckets.set(intervalMs, bucket);
  }
  return bucket;
}

function syncTimer(bucket: BusBucket): void {
  if (bucket.subscribers.size === 0) {
    if (bucket.timer !== null) {
      window.clearInterval(bucket.timer);
      bucket.timer = null;
    }
    buckets.delete(bucket.intervalMs);
    return;
  }
  if (bucket.timer !== null) {
    return;
  }
  bucket.timer = window.setInterval(() => {
    for (const handler of bucket.subscribers.values()) {
      handler();
    }
  }, bucket.intervalMs);
}

/**
 * Subscribe to a shared interval tick. Returns an unsubscribe function.
 * Does not fire immediately — callers own the initial load.
 */
export function subscribeBoardPoll(intervalMs: number, onTick: TickHandler): () => void {
  const id = Symbol("board-poll");
  const bucket = ensureBucket(intervalMs);
  bucket.subscribers.set(id, onTick);
  syncTimer(bucket);
  return () => {
    bucket.subscribers.delete(id);
    syncTimer(bucket);
  };
}

/** Test helper. */
export function resetBoardPollBusForTests(): void {
  for (const bucket of buckets.values()) {
    if (bucket.timer !== null) {
      window.clearInterval(bucket.timer);
    }
  }
  buckets.clear();
}
