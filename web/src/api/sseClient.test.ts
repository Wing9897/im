/**
 * Unit tests for the standalone SSE client.
 *
 * `connectSSE` owns the whole reconnect loop — backoff schedule, the
 * token gate that stops a 401 storm, the abort signal handed to
 * `onBeforeReconnect`, and the timer bookkeeping in `close()`. `client.test.ts`
 * only reaches this module through `ApiClient`, so the timer state is asserted
 * here directly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectSSE,
  type SseEvent,
  type SseEventPayloadMap,
} from "./sseClient";
import type {
  AccountStatusChangedPayload,
  AnalysisPausedChangedPayload,
} from "../types";

// Mirrors the module-private constants in sseClient.ts.
const SSE_RECONNECT_DELAY_MS = 5000;
const SSE_MAX_RECONNECT_DELAY_MS = 60_000;
const SSE_RECONNECT_BACKOFF_FACTOR = 1.5;

const TOKEN_URL = "http://localhost:18820/api/v1/events?token=t1";
const BARE_URL = "http://localhost:18820/api/v1/events";

function createMockEventSourceClass() {
  const instances: Array<{
    url: string;
    close: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    onmessage: ((e: MessageEvent) => void) | null;
    onopen: (() => void) | null;
    onerror: ((e: Event) => void) | null;
    listeners: Record<string, (e: Event) => void>;
  }> = [];

  const MockEventSource = vi.fn(function (this: unknown, url: string) {
    const instance = {
      url,
      close: vi.fn(),
      addEventListener: vi.fn((type: string, handler: (e: Event) => void) => {
        instance.listeners[type] = handler;
      }),
      onmessage: null,
      onopen: null,
      onerror: null,
      listeners: {} as Record<string, (e: Event) => void>,
    };
    instances.push(instance);
    return instance;
  });

  vi.stubGlobal("EventSource", MockEventSource);
  return { MockEventSource, instances };
}

describe("connectSSE", () => {
  let session: { close: () => void } | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    // Deterministic jitter unless a test overrides it.
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(async () => {
    // Close first so any pending reconnect timer is dropped before we
    // hand the clock back.
    session?.close();
    session = null;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // Fake timers can defer setup.ts setAppLocale → saveSystemSettings; absorb
    // those fetches so they do not steal the next suite's mockResolvedValueOnce.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    }) as unknown as typeof fetch;
    await Promise.resolve();
    await Promise.resolve();
  });

  function track(es: { close: () => void }) {
    session = es;
    return es;
  }

  /** Fail the newest source and let its reconnect timer fire. */
  async function failAndAdvance(
    instances: Array<{ onerror: ((e: Event) => void) | null }>,
    delayMs: number,
  ) {
    instances[instances.length - 1].onerror?.(new Event("error"));
    await vi.advanceTimersByTimeAsync(delayMs);
  }

  describe("reconnect backoff", () => {
    it("waits the base delay before the first reconnect", async () => {
      const { instances } = createMockEventSourceClass();
      track(connectSSE(TOKEN_URL, () => {}));

      instances[0].onerror?.(new Event("error"));
      // Reconnect must be scheduled, never immediate — an immediate retry
      // turns a dead backend into a tight EventSource loop.
      expect(instances).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(SSE_RECONNECT_DELAY_MS - 1);
      expect(instances).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(instances).toHaveLength(2);
    });

    it("grows the delay by the backoff factor on consecutive failures", async () => {
      const { instances } = createMockEventSourceClass();
      track(connectSSE(TOKEN_URL, () => {}));

      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);
      expect(instances).toHaveLength(2);

      const secondDelayMs = Math.round(SSE_RECONNECT_DELAY_MS * SSE_RECONNECT_BACKOFF_FACTOR);
      instances[1].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(secondDelayMs - 1);
      expect(instances).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(instances).toHaveLength(3);

      const thirdDelayMs = Math.round(secondDelayMs * SSE_RECONNECT_BACKOFF_FACTOR);
      instances[2].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(thirdDelayMs - 1);
      expect(instances).toHaveLength(3);
      await vi.advanceTimersByTimeAsync(1);
      expect(instances).toHaveLength(4);
    });

    it("caps the growing delay at the maximum", async () => {
      const { instances } = createMockEventSourceClass();
      track(connectSSE(TOKEN_URL, () => {}));

      let delayMs = SSE_RECONNECT_DELAY_MS;
      while (delayMs < SSE_MAX_RECONNECT_DELAY_MS) {
        await failAndAdvance(instances, delayMs);
        delayMs = Math.min(
          SSE_MAX_RECONNECT_DELAY_MS,
          Math.round(delayMs * SSE_RECONNECT_BACKOFF_FACTOR),
        );
      }

      const settled = instances.length;
      instances[settled - 1].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(SSE_MAX_RECONNECT_DELAY_MS - 1);
      expect(instances).toHaveLength(settled);
      await vi.advanceTimersByTimeAsync(1);
      expect(instances).toHaveLength(settled + 1);
    });

    it("adds sub-second jitter on top of the delay", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const { instances } = createMockEventSourceClass();
      track(connectSSE(TOKEN_URL, () => {}));

      instances[0].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(SSE_RECONNECT_DELAY_MS);
      expect(instances).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(500);
      expect(instances).toHaveLength(2);
    });

    it("resets the delay to the base once the connection opens", async () => {
      const { instances } = createMockEventSourceClass();
      track(connectSSE(TOKEN_URL, () => {}));

      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);
      await failAndAdvance(
        instances,
        Math.round(SSE_RECONNECT_DELAY_MS * SSE_RECONNECT_BACKOFF_FACTOR),
      );
      expect(instances).toHaveLength(3);

      // A healthy connection must clear the accumulated backoff, otherwise a
      // long-lived flapping session drifts to the 60s ceiling and stays there.
      instances[2].onopen?.();
      instances[2].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(SSE_RECONNECT_DELAY_MS);
      expect(instances).toHaveLength(4);
    });
  });

  describe("onOpen", () => {
    it("reports the initial open", () => {
      const { instances } = createMockEventSourceClass();
      const opened = vi.fn();
      track(connectSSE(TOKEN_URL, () => {}, { onOpen: opened }));

      expect(opened).not.toHaveBeenCalled();
      instances[0].onopen?.();
      expect(opened).toHaveBeenCalledTimes(1);
    });

    it("reports the open of a source created by a reconnect", async () => {
      const { instances } = createMockEventSourceClass();
      const opened = vi.fn();
      track(connectSSE(TOKEN_URL, () => {}, { onOpen: opened }));

      instances[0].onopen?.();
      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);
      expect(instances).toHaveLength(2);

      // The reconnect swaps in a new EventSource. A caller tracking connection
      // status only leaves "reconnecting" if the callback follows that swap —
      // handlers bound to the first source alone go silent after the first drop.
      instances[1].onopen?.();

      expect(opened).toHaveBeenCalledTimes(2);
    });

    it("keeps reporting opens across several reconnects", async () => {
      const { instances } = createMockEventSourceClass();
      const opened = vi.fn();
      track(connectSSE(TOKEN_URL, () => {}, { onOpen: opened }));

      for (let i = 0; i < 3; i++) {
        instances[instances.length - 1].onopen?.();
        // Each open resets the backoff, so the delay stays at the base.
        await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);
      }
      instances[instances.length - 1].onopen?.();

      expect(instances).toHaveLength(4);
      expect(opened).toHaveBeenCalledTimes(4);
    });
  });

  describe("token gate", () => {
    it("stops the reconnect loop when the rebuilt URL has no token", async () => {
      const { instances } = createMockEventSourceClass();
      track(connectSSE(BARE_URL, () => {}));
      expect(instances).toHaveLength(1);

      instances[0].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(5 * 60_000);

      // Bare /events 401-loops once localhost_auth_exempt is false: the loop
      // must die outright rather than retry forever.
      expect(instances).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("treats a blank token as no token", async () => {
      const { instances } = createMockEventSourceClass();
      track(connectSSE(`${BARE_URL}?token=%20`, () => {}));

      instances[0].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(5 * 60_000);

      expect(instances).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("falls back to substring matching for relative URLs", async () => {
      const { instances } = createMockEventSourceClass();
      // `new URL()` throws without a base, so the gate must not read a
      // relative-but-authenticated URL as token-less.
      track(connectSSE("/api/v1/events?token=t1", () => {}));

      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);
      expect(instances).toHaveLength(2);
    });

    it("re-reads the URL factory so a rotated token is picked up", async () => {
      const { MockEventSource, instances } = createMockEventSourceClass();
      let token = "t1";
      track(connectSSE(() => `${BARE_URL}?token=${token}`, () => {}));
      expect(MockEventSource).toHaveBeenLastCalledWith(`${BARE_URL}?token=t1`);

      token = "t2";
      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);

      expect(MockEventSource).toHaveBeenLastCalledWith(`${BARE_URL}?token=t2`);
    });
  });

  describe("onBeforeReconnect", () => {
    it("reconnects with a live abort signal when the gate resolves true", async () => {
      const { instances } = createMockEventSourceClass();
      const seen = { abortedAtCall: true };
      const gate = vi.fn((signal: AbortSignal) => {
        seen.abortedAtCall = signal.aborted;
        return Promise.resolve(true);
      });

      track(connectSSE(TOKEN_URL, () => {}, { onBeforeReconnect: gate }));
      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);

      expect(gate).toHaveBeenCalledTimes(1);
      expect(seen.abortedAtCall).toBe(false);
      expect(instances).toHaveLength(2);
    });

    it("kills the loop when the gate returns false", async () => {
      const { instances } = createMockEventSourceClass();
      const gate = vi.fn(() => false);

      track(connectSSE(TOKEN_URL, () => {}, { onBeforeReconnect: gate }));
      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);

      expect(gate).toHaveBeenCalledTimes(1);
      expect(instances).toHaveLength(1);

      // The abort is permanent — a later error must not restart the loop.
      instances[0].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(gate).toHaveBeenCalledTimes(1);
      expect(instances).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("treats a throwing gate as an abort", async () => {
      const { instances } = createMockEventSourceClass();
      const gate = vi.fn(() => {
        throw new Error("refresh exploded");
      });

      track(connectSSE(TOKEN_URL, () => {}, { onBeforeReconnect: gate }));
      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);

      expect(gate).toHaveBeenCalledTimes(1);
      expect(instances).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("close()", () => {
    it("clears the pending reconnect timer", async () => {
      const { instances } = createMockEventSourceClass();
      const es = track(connectSSE(TOKEN_URL, () => {}));

      instances[0].onerror?.(new Event("error"));
      expect(vi.getTimerCount()).toBe(1);

      es.close();

      // A `closed` flag alone would leave the timeout armed; the handle has to
      // be cleared or the session keeps a live timer after teardown.
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(instances).toHaveLength(1);
    });

    it("aborts an in-flight onBeforeReconnect probe", async () => {
      const { instances } = createMockEventSourceClass();
      const probe: {
        signal: AbortSignal | null;
        resolve: ((proceed: boolean) => void) | null;
      } = { signal: null, resolve: null };
      const gate = vi.fn((signal: AbortSignal) => {
        probe.signal = signal;
        return new Promise<boolean>((resolve) => {
          probe.resolve = resolve;
        });
      });

      const es = track(connectSSE(TOKEN_URL, () => {}, { onBeforeReconnect: gate }));
      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);
      expect(gate).toHaveBeenCalledTimes(1);
      expect(probe.signal?.aborted).toBe(false);

      es.close();
      expect(probe.signal?.aborted).toBe(true);

      // Even a late "yes" from the probe must not resurrect the connection.
      probe.resolve?.(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(instances).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("closes the currently active source after a reconnect", async () => {
      const { instances } = createMockEventSourceClass();
      const es = track(connectSSE(TOKEN_URL, () => {}));

      await failAndAdvance(instances, SSE_RECONNECT_DELAY_MS);
      expect(instances).toHaveLength(2);
      expect(instances[1].close).not.toHaveBeenCalled();

      es.close();

      // The handle outlives each EventSource, so close() must reach whichever
      // one the loop swapped in — not the source that was returned first.
      expect(instances[1].close).toHaveBeenCalled();
    });

    it("leaves no timer behind when closed while connected", () => {
      createMockEventSourceClass();
      const es = track(connectSSE(TOKEN_URL, () => {}));

      es.close();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("event delivery", () => {
    it("keeps hand-written payloads aligned with server contract fields", () => {
      const payloads = {
        messages_updated: {
          messages: [
            {
              id: "message-1",
              accountId: "account-1",
              platform: "telegram",
              platformId: "channel-1",
              channelName: "Announcements",
              platformMessageId: "42",
              senderId: "user-1",
              senderName: "Alice",
              content: "Hello",
              timestamp: "2026-07-28T09:00:00Z",
              rawData: null,
              media: null,
              createdAt: "2026-07-28T09:00:01Z",
            },
          ],
        },
        collector_status_changed: { status: "running" },
        account_status_changed: {
          accountId: "account-1",
          status: "connecting",
          lastError: null,
        },
        analysis_started: {
          taskId: "task-1",
          taskName: "Task 1",
          batchId: "batch-1",
          messageCount: 5,
          estimatedTokens: 120,
          llmProvider: "ollama",
          llmModel: "qwen3",
        },
        analysis_completed: {
          taskId: "task-1",
          batchId: "batch-1",
          analysisMode: "event",
          findingsCount: 2,
          hasFindings: true,
          overlapStatistics: {
            overlapUsedCount: 1,
            overlapTrimmedCount: 0,
            overlapTokens: 20,
            primaryTokens: 100,
            totalTokens: 120,
          },
        },
        analysis_failed: {
          taskId: "task-1",
          taskName: "Task 1",
          batchId: "batch-1",
          error: "timeout",
          retrying: true,
          currentRetry: 2,
          maxRetries: 3,
          retriesExhausted: false,
        },
        analysis_paused_changed: {
          analysisPaused: true,
          reason: "batch_retries_exhausted",
          taskId: "task-1",
          taskName: "Task 1",
          batchId: "batch-1",
        },
        resource_modified: {
          resourceType: "user_event",
          resourceId: "event-1",
          action: "updated",
        },
      } satisfies SseEventPayloadMap;

      expect(Object.keys(payloads)).toHaveLength(8);
    });

    it("unwraps the { type, payload } envelope of named events", () => {
      const { instances } = createMockEventSourceClass();
      const received: SseEvent[] = [];
      track(connectSSE(TOKEN_URL, (e) => received.push(e)));

      instances[0].listeners["analysis_completed"]?.({
        data: '{"type":"analysis_completed","payload":{"taskId":"t-1"}}',
      } as MessageEvent);

      expect(received).toEqual([
        { event: "analysis_completed", data: { taskId: "t-1" } },
      ]);
    });

    it("passes through non-JSON payloads instead of dropping the event", () => {
      const { instances } = createMockEventSourceClass();
      const received: SseEvent[] = [];
      track(connectSSE(TOKEN_URL, (e) => received.push(e)));

      instances[0].listeners["messages_updated"]?.({ data: "not-json" } as MessageEvent);

      expect(received).toEqual([{ event: "messages_updated", data: "not-json" }]);
    });

    it("delivers typed pause and connecting payloads", () => {
      const { instances } = createMockEventSourceClass();
      const received: SseEvent[] = [];
      track(connectSSE(TOKEN_URL, (event) => received.push(event)));
      const paused = {
        analysisPaused: true,
        reason: "batch_retries_exhausted",
        taskId: "task-1",
        taskName: "Task 1",
        batchId: "batch-1",
      } satisfies AnalysisPausedChangedPayload;
      const connecting = {
        accountId: "account-1",
        status: "connecting",
        lastError: "retrying",
      } satisfies AccountStatusChangedPayload;

      instances[0].listeners.analysis_paused_changed?.({
        data: JSON.stringify({ type: "analysis_paused_changed", payload: paused }),
      } as MessageEvent);
      instances[0].listeners.account_status_changed?.({
        data: JSON.stringify({ type: "account_status_changed", payload: connecting }),
      } as MessageEvent);

      expect(received).toEqual([
        { event: "analysis_paused_changed", data: paused },
        { event: "account_status_changed", data: connecting },
      ]);
    });
  });
});
