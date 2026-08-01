import { toError } from "./errors";

type QueuedArgsMerger<Args extends unknown[]> = (
  current: Args | null,
  next: Args,
) => Args;

function takeLatestArgs<Args extends unknown[]>(
  _current: Args | null,
  next: Args,
): Args {
  return next;
}

/**
 * Creates a serialized async runner that ensures only one invocation of `task`
 * runs at a time. Subsequent calls while in-flight are merged and executed after
 * the current run completes.
 */
export function createSerializedAsyncRunner<Args extends unknown[]>(
  task: (...args: Args) => Promise<void>,
  mergeQueuedArgs: QueuedArgsMerger<Args> = takeLatestArgs,
  onError?: (error: Error) => void,
): { run: (...args: Args) => Promise<void>; queueLength: () => number } {
  let inFlight = false;
  let queuedArgs: Args | null = null;

  const run = async (...args: Args): Promise<void> => {
    if (inFlight) {
      queuedArgs = mergeQueuedArgs(queuedArgs, args);
      return;
    }

    inFlight = true;
    try {
      await task(...args);
    } catch (error) {
      onError?.(toError(error));
    } finally {
      inFlight = false;
      if (queuedArgs) {
        const nextArgs = queuedArgs;
        queuedArgs = null;
        void run(...nextArgs);
      }
    }
  };

  return {
    run,
    queueLength: () => (queuedArgs !== null ? 1 : 0),
  };
}
