/**
 * Isolated GET retry tests — single case per file avoids fake-timer bleed between
 * examples in the same file when global fetch is stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";

describe("ApiClient GET retries — HTTP 503", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries GET on 503 then succeeds", async () => {
    vi.useFakeTimers();
    let healthGetCalls = 0;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/v1/health")) {
        healthGetCalls += 1;
        if (healthGetCalls === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: "Unavailable",
            json: () => Promise.resolve({ error: "unavailable", message: "busy" }),
            text: () => Promise.resolve("busy"),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true }),
          text: () => Promise.resolve(""),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient("http://localhost:18820");

    // Contract: delays [400, 1000] → up to 3 attempts; one 503 then success = 2 GETs.
    const resultPromise = client.get<{ ok: boolean }>("/api/v1/health", undefined, {
      timeoutMs: 0,
    });
    await vi.advanceTimersByTimeAsync(400);
    await expect(resultPromise).resolves.toEqual({ ok: true });
    expect(healthGetCalls).toBe(2);
  });
});
