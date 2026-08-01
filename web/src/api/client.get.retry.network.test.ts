/**
 * Isolated GET retry tests — single case per file avoids fake-timer bleed between
 * examples in the same file when global fetch is stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient, NetworkError } from "./client";

describe("ApiClient GET retries — network failure", () => {
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

  it("converts fetch-level TypeError into NetworkError so callers can distinguish connectivity issues", async () => {
    vi.useFakeTimers();
    let taskGetCalls = 0;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo) => {
      const url = String(input);
      if (url.includes("/api/v1/tasks")) {
        taskGetCalls += 1;
        return Promise.reject(new TypeError("Failed to fetch"));
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

    const failure = client.get("/api/v1/tasks", undefined, { timeoutMs: 0 });
    const assertion = expect(failure).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof NetworkError && error.message === "Backend unreachable",
    );
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(taskGetCalls).toBe(3);
  });
});
