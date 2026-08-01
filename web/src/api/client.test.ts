/**
 * Unit tests for the unified ApiClient.
 * Tests HTTP methods, token management, error handling, and SSE.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient, ApiRequestError, NetworkError, resolveBaseUrl } from "./client";
import type { ApiError } from "./client";
import { errorToastEmitter } from "./errorToastEmitter";
import {
  _resetConnectionStoreForTests,
  saveDeviceSession,
  setServerBaseUrl,
} from "../domain/connection/connectionStore";

// ─── Mock fetch ──────────────────────────────────────────────────────────

function mockFetch(response: {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}) {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    statusText: "Status Text",
    json: response.json ?? (() => Promise.resolve({})),
    text: response.text ?? (() => Promise.resolve("")),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

// ─── Mock localStorage ────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// ─── Tests ────────────────────────────────────────────────────────────────

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

  describe("constructor", () => {
    it("uses provided base URL", async () => {
      const c = new ApiClient("http://example.com:8080");
      const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve([]) });
      await c.get("/api/v1/tasks");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://example.com:8080/api/v1/tasks",
        expect.anything(),
      );
    });

    it("strips trailing slashes from base URL", async () => {
      const c = new ApiClient("http://example.com:8080///");
      const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve([]) });
      await c.get("/api/v1/tasks");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://example.com:8080/api/v1/tasks",
        expect.anything(),
      );
    });
  });

  describe("token management", () => {
    it("setToken stores access in im:connection without inventing refresh", () => {
      client.setToken("my-secret-token");
      expect(client.getToken()).toBe("my-secret-token");
      expect(localStorageMock.getItem("im_api_token")).toBeNull();
      const raw = localStorageMock.getItem("im:connection");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as { accessToken: string; refreshToken: string | null };
      expect(parsed.accessToken).toBe("my-secret-token");
      expect(parsed.refreshToken).toBeNull();
    });

    it("getToken returns access from im:connection", () => {
      saveDeviceSession({ accessToken: "test-token", refreshToken: "refresh-token" });
      expect(client.getToken()).toBe("test-token");
    });

    it("getToken returns undefined when no token stored", () => {
      expect(client.getToken()).toBeUndefined();
    });

    it("clearToken removes device session", () => {
      saveDeviceSession({ accessToken: "to-remove", refreshToken: "r" });
      client.clearToken();
      expect(client.getToken()).toBeUndefined();
    });

    it("setToken with existing refresh updates access only", () => {
      saveDeviceSession({ accessToken: "old", refreshToken: "keep-refresh" });
      client.setToken("new-access");
      expect(client.getToken()).toBe("new-access");
      const parsed = JSON.parse(localStorageMock.getItem("im:connection")!) as {
        refreshToken: string;
      };
      expect(parsed.refreshToken).toBe("keep-refresh");
    });
  });

  describe("get()", () => {
    it("sends GET request and returns parsed JSON", async () => {
      const data = [{ id: "1", name: "Task 1" }];
      const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve(data) });

      const result = await client.get("/api/v1/tasks");

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:18820/api/v1/tasks",
        expect.objectContaining({ method: "GET" }),
      );
      expect(result).toEqual(data);
    });

    it("appends query parameters to URL", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve([]) });

      await client.get("/api/v1/tasks", { task_id: "abc" });

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain("task_id=abc");
    });

    it("includes Authorization header when token is set", async () => {
      saveDeviceSession({ accessToken: "bearer-test", refreshToken: "r" });
      const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve({}) });

      await client.get("/api/v1/tasks");

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer bearer-test");
    });

    it("omits Authorization header when no token", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve({}) });

      await client.get("/api/v1/tasks");

      const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });
  });

  describe("post()", () => {
    it("sends POST request with JSON body", async () => {
      const body = { name: "New Task", prompt: "Test" };
      const responseData = { id: "2", ...body };
      const fetchMock = mockFetch({ ok: true, status: 201, json: () => Promise.resolve(responseData) });

      const result = await client.post("/api/v1/tasks", body);

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:18820/api/v1/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
      expect(result).toEqual(responseData);
    });

    it("sends POST without body when no body provided", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve({}) });

      await client.post("/api/v1/accounts/refresh-all");

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBeUndefined();
    });
  });

  describe("put()", () => {
    it("sends PUT request with JSON body", async () => {
      const body = { name: "Updated Task" };
      const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve(body) });

      await client.put("/api/v1/tasks/123", body);

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:18820/api/v1/tasks/123",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(body),
        }),
      );
    });
  });

  describe("patch()", () => {
    it("sends PATCH request", async () => {
      const fetchMock = mockFetch({ ok: true, status: 200, json: () => Promise.resolve({ isActive: true }) });

      await client.patch("/api/v1/tasks/123/active", { active: true });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:18820/api/v1/tasks/123/active",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  describe("delete()", () => {
    it("sends DELETE request and handles 204 No Content", async () => {
      mockFetch({ ok: true, status: 204 });

      const result = await client.delete("/api/v1/tasks/123");

      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("throws ApiRequestError with parsed error body on non-OK response", async () => {
      const errorBody: ApiError = { error: "not_found", message: "Task not found" };
      mockFetch({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorBody),
      });

      await expect(client.get("/api/v1/tasks/999")).rejects.toThrow(ApiRequestError);

      try {
        await client.get("/api/v1/tasks/999");
      } catch (err) {
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(404);
        expect(apiErr.errorCode).toBe("not_found");
        expect(apiErr.message).toBe("Task not found");
      }
    });

    it("handles non-JSON error responses gracefully", async () => {
      mockFetch({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("not json")),
        text: () => Promise.resolve("Internal Server Error"),
      });

      try {
        await client.get("/api/v1/tasks");
      } catch (err) {
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(500);
        expect(apiErr.errorCode).toBe("http_500");
        expect(apiErr.message).toBe("Internal Server Error");
      }
    });

    it("handles unexpected error body format", async () => {
      mockFetch({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ unexpected: "format" }),
      });

      try {
        await client.get("/api/v1/config/settings");
      } catch (err) {
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(422);
        expect(apiErr.errorCode).toBe("http_422");
      }
    });

    it("maps AbortError to NetworkError (timeout when no external signal)", async () => {
      const abortError = new DOMException("Aborted", "AbortError");
      globalThis.fetch = vi.fn().mockRejectedValue(abortError) as unknown as typeof fetch;

      await expect(client.get("/api/v1/tasks", undefined, { timeoutMs: 0 })).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof NetworkError && error.message === "Request timed out",
      );
    });

    it("does not emit structured ErrorToast by default (list GET path)", async () => {
      const emitSpy = vi.spyOn(errorToastEmitter, "emit");
      mockFetch({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error_code: "VALIDATION_ERROR",
            message: "bad request",
            correlation_id: "corr-1",
            details: null,
          }),
      });

      await expect(client.get("/api/v1/tasks")).rejects.toThrow(ApiRequestError);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it("emits structured ErrorToast when emitErrorToast is opted in", async () => {
      const emitSpy = vi.spyOn(errorToastEmitter, "emit");
      mockFetch({
        ok: false,
        status: 503,
        json: () =>
          Promise.resolve({
            error_code: "COLLECTOR_UNAVAILABLE",
            message: "down",
            correlation_id: "corr-2",
            details: null,
          }),
      });

      await expect(
        client.post("/api/v1/accounts", {}, { emitErrorToast: true, timeoutMs: 0 }),
      ).rejects.toThrow(ApiRequestError);
      expect(emitSpy).toHaveBeenCalledOnce();
      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: "COLLECTOR_UNAVAILABLE",
          message: "down",
          correlationId: "corr-2",
        }),
      );
    });
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

const SSE_RECONNECT_DELAY_MS = 5000;

describe("ApiClient 401 refresh", () => {
  let client: ApiClient;

  beforeEach(async () => {
    localStorageMock.clear();
    _resetConnectionStoreForTests();
    client = new ApiClient("http://localhost:18820");
    // Drain deferred setAppLocale → saveSystemSettings from setup/fake-timer tests.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    }) as unknown as typeof fetch;
    await Promise.resolve();
    await Promise.resolve();
    saveDeviceSession({ accessToken: "old-access", refreshToken: "refresh-1" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function authRelatedCalls(fetchMock: ReturnType<typeof vi.fn>): string[] {
    return fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter(
        (url) =>
          url.includes("/api/v1/tasks") || url.includes("/api/v1/setup/refresh"),
      );
  }

  it("refreshes once on 401 then retries the original request", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/setup/refresh")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: () =>
            Promise.resolve({
              accessToken: "new-access",
              refreshToken: "new-refresh",
              accessExpiresAt: "t1",
              refreshExpiresAt: "t2",
              device: { id: "d1", label: "Browser" },
            }),
          text: () => Promise.resolve(""),
        };
      }
      if (url.includes("/api/v1/tasks")) {
        if (client.getToken() === "new-access") {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: () => Promise.resolve({ ok: true }),
            text: () => Promise.resolve(""),
          };
        }
        return {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: () => Promise.resolve({ error: "unauthorized", message: "expired" }),
          text: () => Promise.resolve(""),
        };
      }
      // Ignore background locale/settings writes from test setup.
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await client.get<{ ok: boolean }>("/api/v1/tasks");

    expect(result).toEqual({ ok: true });
    const authCalls = authRelatedCalls(fetchMock);
    expect(authCalls).toHaveLength(3);
    expect(authCalls[0]).toContain("/api/v1/tasks");
    expect(authCalls[1]).toContain("/api/v1/setup/refresh");
    expect(authCalls[2]).toContain("/api/v1/tasks");
    expect(client.getToken()).toBe("new-access");
  });

  it("does not loop refresh when refresh itself returns 401", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/setup/refresh") || url.includes("/api/v1/tasks")) {
        return {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: () => Promise.resolve({ error: "unauthorized", message: "expired" }),
          text: () => Promise.resolve(""),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      };
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(client.get("/api/v1/tasks")).rejects.toThrow(ApiRequestError);
    expect(authRelatedCalls(fetchMock)).toHaveLength(2);
  });
});

describe("resolveBaseUrl", () => {
  beforeEach(() => {
    localStorageMock.clear();
    _resetConnectionStoreForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns window.location.origin without trailing slash when VITE_API_BASE_URL is not set", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubGlobal("location", { origin: "http://localhost:18820///" });

    expect(resolveBaseUrl()).toBe("http://localhost:18820");
    expect(resolveBaseUrl().endsWith("/")).toBe(false);
  });

  it("strips trailing slashes from origin", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubGlobal("location", { origin: "https://example.com:8443/" });

    expect(resolveBaseUrl()).toBe("https://example.com:8443");
  });

  it("prefers persisted custom serverBaseUrl", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubGlobal("location", { origin: "http://localhost:5173" });
    setServerBaseUrl("http://10.0.0.2:18820/");
    expect(resolveBaseUrl()).toBe("http://10.0.0.2:18820");
  });
});

