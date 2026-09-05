/**
 * ApiClient 401 refresh + resolveBaseUrl.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient, ApiRequestError, resolveBaseUrl } from "./client";
import {
  saveDeviceSession,
  setServerBaseUrl,
} from "../domain/connection/connectionStore";
import { _resetConnectionStoreForTests } from "../domain/connection/connectionStore.testing";
import { localStorageMock } from "./clientTestUtils";

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
          url.includes("/api/v1/tasks") ||
          url.includes("/api/v1/setup/refresh"),
      );
  }

  it("refreshes once on 401 then retries the original request", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL) => {
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
            json: () =>
              Promise.resolve({ error: "unauthorized", message: "expired" }),
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
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (
          url.includes("/api/v1/setup/refresh") ||
          url.includes("/api/v1/tasks")
        ) {
          return {
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            json: () =>
              Promise.resolve({ error: "unauthorized", message: "expired" }),
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
