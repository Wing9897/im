import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { AppLogEntryPayload, AppLogPagePayload } from "../../types";
import { useRuntimeLogState as useRuntimeLogs } from "./runtimeLogState";
import type { RuntimeLogsState } from "./runtimeLogsTypes";

export const runtimeLogsHarness = {
  latestState: null as RuntimeLogsState | null,
};

function HookHarness() {
  runtimeLogsHarness.latestState = useRuntimeLogs();
  return null;
}

export function renderHarness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<HookHarness />);
  });
  return { container, root };
}

export function cleanupHarness(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
  runtimeLogsHarness.latestState = null;
}

export function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function makePayload(id: string, message: string): AppLogEntryPayload {
  return {
    id,
    time: `2026-04-15T03:00:0${id}.000Z`,
    level: "info",
    category: "system",
    message,
    details: null,
  };
}

export function makePage(
  logs: AppLogEntryPayload[],
  overrides: Partial<AppLogPagePayload> = {},
): AppLogPagePayload {
  return {
    logs,
    nextCursor:
      overrides.nextCursor !== undefined
        ? overrides.nextCursor
        : logs.length > 0
          ? {
              time: logs[logs.length - 1].time,
              id: logs[logs.length - 1].id,
            }
          : null,
    hasMore: false,
    totalCount: logs.length,
    ...overrides,
  };
}

export async function flushUpdates() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
