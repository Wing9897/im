/**
 * ApiClient connectSSE reconnect / token refresh behavior.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient } from "./client";
import {
  _resetConnectionStoreForTests,
  saveDeviceSession,
} from "../domain/connection/connectionStore";
import { localStorageMock } from "./clientTestUtils";

const SSE_RECONNECT_DELAY_MS = 5000;

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.useRealTimers();
    localStorageMock.clear();
    _resetConnectionStoreForTests();
    client = new ApiClient("http://localhost:18820");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("connectSSE()", () => {
    let lastEventSource: { close: () => void } | null = null;

    afterEach(async () => {
      // Close first so pending reconnect timers no-op.
      lastEventSource?.close();
      lastEventSource = null;
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.unstubAllGlobals();
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

    function track(es: { close: () => void }) {
      lastEventSource = es;
      return es;
    }

    it("creates EventSource with correct URL", () => {
      const { MockEventSource } = createMockEventSourceClass();

      track(client.connectSSE(() => {}));

      expect(MockEventSource).toHaveBeenCalledWith("http://localhost:18820/api/v1/events");
    });

    it("includes token as query param in SSE URL when set", () => {
      saveDeviceSession({ accessToken: "sse-token", refreshToken: "r" });
      const { MockEventSource } = createMockEventSourceClass();

      track(client.connectSSE(() => {}));

      expect(MockEventSource).toHaveBeenCalledWith(
        "http://localhost:18820/api/v1/events?token=sse-token",
      );
    });

    it("calls onEvent with parsed data for named events", () => {
      const { instances } = createMockEventSourceClass();

      const events: { event: string; data: unknown }[] = [];
      track(client.connectSSE((e) => events.push(e)));

      // Simulate a named event
      const messageEvent = { data: '{"channelId":"ch1","count":5}' } as MessageEvent;
      instances[0].listeners["messages_updated"]?.(messageEvent);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        event: "messages_updated",
        data: { channelId: "ch1", count: 5 },
      });
    });

    it("auto-reconnects after error with 5s delay", async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      saveDeviceSession({ accessToken: "sse-token", refreshToken: "r" });
      const { instances } = createMockEventSourceClass();

      track(client.connectSSE(() => {}));
      expect(instances).toHaveLength(1);

      instances[0].onerror?.(new Event("error"));
      expect(instances).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(SSE_RECONNECT_DELAY_MS);
      expect(instances).toHaveLength(2);
    });

    it("rebuilds SSE URL with refreshed token on reconnect", async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      saveDeviceSession({ accessToken: "old-token", refreshToken: "r" });
      const { MockEventSource, instances } = createMockEventSourceClass();

      track(client.connectSSE(() => {}));
      expect(MockEventSource).toHaveBeenLastCalledWith(
        "http://localhost:18820/api/v1/events?token=old-token",
      );

      saveDeviceSession({ accessToken: "new-token", refreshToken: "r" });
      instances[0].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(SSE_RECONNECT_DELAY_MS);

      expect(MockEventSource).toHaveBeenLastCalledWith(
        "http://localhost:18820/api/v1/events?token=new-token",
      );
    });

    it("stops reconnecting when session has no access token", async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { instances } = createMockEventSourceClass();

      track(client.connectSSE(() => {}));
      expect(instances).toHaveLength(1);

      instances[0].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(SSE_RECONNECT_DELAY_MS + 1000);
      expect(instances).toHaveLength(1);
    });

    it("does not reconnect after explicit close()", async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { instances } = createMockEventSourceClass();

      const es = track(client.connectSSE(() => {}));
      es.close();

      instances[0].onerror?.(new Event("error"));

      await vi.advanceTimersByTimeAsync(SSE_RECONNECT_DELAY_MS + 1000);
      expect(instances).toHaveLength(1);
    });

    it("refreshes access on reconnect when stored expiry is past", async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      const past = new Date(Date.now() - 60_000).toISOString();
      saveDeviceSession({
        accessToken: "stale-token",
        refreshToken: "refresh-1",
        accessExpiresAt: past,
      });

      const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/setup/refresh")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              accessToken: "rotated-token",
              refreshToken: "refresh-1",
              accessExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
              refreshExpiresAt: "",
            }),
          };
        }
        return { ok: true, status: 200, text: async () => "", json: async () => ({}) };
      });
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const { MockEventSource, instances } = createMockEventSourceClass();
      track(client.connectSSE(() => {}));
      expect(MockEventSource).toHaveBeenLastCalledWith(
        "http://localhost:18820/api/v1/events?token=stale-token",
      );

      instances[0].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(SSE_RECONNECT_DELAY_MS);

      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/v1/setup/refresh"))).toBe(
        true,
      );
      expect(MockEventSource).toHaveBeenLastCalledWith(
        "http://localhost:18820/api/v1/events?token=rotated-token",
      );
    });

    it("stops reconnect when probe returns 401 and refresh fails", async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(0);
      const future = new Date(Date.now() + 3_600_000).toISOString();
      saveDeviceSession({
        accessToken: "bad-token",
        refreshToken: "refresh-1",
        accessExpiresAt: future,
      });

      const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/setup/devices")) {
          return { ok: false, status: 401, text: async () => "", json: async () => ({}) };
        }
        if (url.includes("/api/v1/setup/refresh")) {
          return { ok: false, status: 401, text: async () => "", json: async () => ({}) };
        }
        return { ok: true, status: 200, text: async () => "", json: async () => ({}) };
      });
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const { instances } = createMockEventSourceClass();
      track(client.connectSSE(() => {}));
      instances[0].onerror?.(new Event("error"));
      await vi.advanceTimersByTimeAsync(SSE_RECONNECT_DELAY_MS + 1000);
      expect(instances).toHaveLength(1);
    });
  });
});
