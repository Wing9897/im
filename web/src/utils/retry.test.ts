import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withRetry } from "./retry";

describe("retry utils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks shouldAbort before each retry attempt", async () => {
    let attempt = 0;
    const operation = vi.fn<() => Promise<string>>().mockImplementation(() => {
      attempt += 1;
      return Promise.reject(new Error(`fail-${attempt}`));
    });

    const shouldAbort = vi.fn<() => boolean>().mockImplementation(() => {
      // Abort after the 2nd attempt (attempt 0 and 1 run, abort before attempt 2)
      return attempt >= 2;
    });

    const promise = withRetry(operation, {
      delays: [10, 10, 10],
      shouldAbort,
      abortValue: () => "aborted",
    });

    // Advance past the first retry delay
    await vi.advanceTimersByTimeAsync(10);
    // Advance past the second retry delay — shouldAbort triggers after catch
    await vi.advanceTimersByTimeAsync(10);

    await expect(promise).resolves.toBe("aborted");
    // Operation called twice (attempt 0 and 1), then shouldAbort stopped it
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("retries until the operation succeeds", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(operation, { delays: [100] });
    await Promise.resolve();

    expect(operation).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("stops retrying when shouldRetry rejects the error", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error("fatal"));

    await expect(
      withRetry(operation, {
        delays: [100, 200],
        shouldRetry: () => false,
      }),
    ).rejects.toThrow("fatal");

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("returns the abort value when aborted between attempts", async () => {
    const operation = vi
      .fn<() => Promise<string[]>>()
      .mockRejectedValue(new Error("temporary"));
    const shouldAbort = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    await expect(
      withRetry(operation, {
        delays: [100],
        shouldAbort,
        abortValue: () => [],
      }),
    ).resolves.toEqual([]);

    expect(operation).toHaveBeenCalledTimes(1);
  });
});

// Feature: project-audit-optimization, Property 10: 重試次數上界
describe("withRetry execution count upper bound", () => {
  it.each([
    [[]],
    [[0]],
    [[0, 0]],
    [[0, 0, 0]],
    [[0, 0, 0, 0, 0]],
    [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ])(
    "for delays %j, always-failing operation executes at most delays.length + 1 times",
    async (delays) => {
      let executionCount = 0;

      const alwaysFail = async (): Promise<string> => {
        executionCount += 1;
        throw new Error("always fails");
      };

      try {
        await withRetry(alwaysFail, { delays });
      } catch {
        // Expected to throw
      }

      const maxExpected = delays.length + 1;
      expect(executionCount).toBeLessThanOrEqual(maxExpected);
      expect(executionCount).toBe(maxExpected);
    },
  );
});
