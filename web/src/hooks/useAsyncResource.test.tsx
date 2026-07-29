import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAsyncResource, type UseAsyncResourceOptions, type UseAsyncResourceResult } from "./useAsyncResource";

vi.mock("../context/ToastContext", async () =>
  (await import("../test/context-mocks")).toastContextModuleMock());

import { mockShowToast } from "../test/context-mocks";

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
let latest: UseAsyncResourceResult<unknown, unknown> | null = null;

function Harness({
  fetcher,
  options,
}: {
  fetcher: (args: unknown) => Promise<unknown>;
  options?: UseAsyncResourceOptions;
}) {
  latest = useAsyncResource(fetcher, options);
  return null;
}

function renderHarness(
  fetcher: (args: unknown) => Promise<unknown>,
  options?: UseAsyncResourceOptions,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness fetcher={fetcher} options={options} />);
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function makeDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useAsyncResource", () => {
  beforeEach(() => {
    latest = null;
    mockShowToast.mockReset();
  });

  afterEach(() => {
    latest = null;
  });

  it("success: settles data and clears loading/error when the fetcher resolves", async () => {
    const fetcher = vi.fn<(args: { id: string }) => Promise<{ value: number }>>()
      .mockResolvedValue({ value: 42 });
    const { root, container } = renderHarness(
      fetcher as unknown as (args: unknown) => Promise<unknown>,
    );

    // Initial state before any execute call.
    expect(latest!.data).toBeNull();
    expect(latest!.loading).toBe(false);
    expect(latest!.error).toBeNull();

    let result: unknown;
    await act(async () => {
      result = await latest!.execute({ id: "x" });
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({ id: "x" });
    expect(result).toEqual({ value: 42 });
    expect(latest!.data).toEqual({ value: 42 });
    expect(latest!.loading).toBe(false);
    expect(latest!.error).toBeNull();
    expect(mockShowToast).not.toHaveBeenCalled();

    cleanup(root, container);
  });

  it("error: sets error and resolves execute() to null without toast by default", async () => {
    const fetcher = vi.fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error("boom"));
    const { root, container } = renderHarness(
      fetcher as unknown as (args: unknown) => Promise<unknown>,
    );

    let result: unknown;
    await act(async () => {
      result = await latest!.execute(undefined);
    });

    expect(result).toBeNull();
    expect(latest!.data).toBeNull();
    expect(latest!.loading).toBe(false);
    expect(latest!.error).toBe("boom");
    expect(mockShowToast).not.toHaveBeenCalled();

    cleanup(root, container);
  });

  it("error: surfaces toast when toastOnError is true", async () => {
    const fetcher = vi.fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error("boom"));
    const { root, container } = renderHarness(
      fetcher as unknown as (args: unknown) => Promise<unknown>,
      { toastOnError: true },
    );

    await act(async () => {
      await latest!.execute(undefined);
    });

    expect(latest!.error).toBe("boom");
    expect(mockShowToast).toHaveBeenCalledTimes(1);
    expect(mockShowToast).toHaveBeenCalledWith("boom", "error");

    cleanup(root, container);
  });

  it("stale: drops the earlier in-flight response when a newer execute() starts", async () => {
    // Two deferred promises so we can control resolution order independently
    // of call order.
    const first = makeDeferred<string>();
    const second = makeDeferred<string>();

    const fetcher = vi.fn<() => Promise<string>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { root, container } = renderHarness(
      fetcher as unknown as (args: unknown) => Promise<unknown>,
    );

    let firstPromise!: Promise<unknown>;
    let secondPromise!: Promise<unknown>;

    // Kick off both requests before either resolves. The second call should
    // invalidate the first via useLatestRequest.
    act(() => {
      firstPromise = latest!.execute(undefined);
    });
    act(() => {
      secondPromise = latest!.execute(undefined);
    });

    expect(fetcher).toHaveBeenCalledTimes(2);

    // Resolve the newer request first — it wins and updates state.
    await act(async () => {
      second.resolve("second");
      const secondResult = await secondPromise;
      expect(secondResult).toBe("second");
    });

    expect(latest!.data).toBe("second");
    expect(latest!.loading).toBe(false);
    expect(latest!.error).toBeNull();

    // Now resolve the older request — its result must be discarded and
    // execute() must resolve to null for the stale caller.
    await act(async () => {
      first.resolve("first");
      const firstResult = await firstPromise;
      expect(firstResult).toBeNull();
    });

    // State is still from the newer request.
    expect(latest!.data).toBe("second");
    expect(latest!.error).toBeNull();

    cleanup(root, container);
  });

  it("refresh: keeps initialLoading false and isRefreshing true when data is cached", async () => {
    const deferred = makeDeferred<string>();
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("cached")
      .mockReturnValueOnce(deferred.promise);

    const { root, container } = renderHarness(
      fetcher as unknown as (args: unknown) => Promise<unknown>,
    );

    await act(async () => {
      await latest!.execute(undefined);
    });
    expect(latest!.data).toBe("cached");
    expect(latest!.initialLoading).toBe(false);
    expect(latest!.isRefreshing).toBe(false);

    let refreshPromise!: Promise<unknown>;
    act(() => {
      refreshPromise = latest!.execute(undefined);
    });

    expect(latest!.initialLoading).toBe(false);
    expect(latest!.isRefreshing).toBe(true);
    expect(latest!.data).toBe("cached");

    await act(async () => {
      deferred.resolve("updated");
      await refreshPromise;
    });

    expect(latest!.data).toBe("updated");
    expect(latest!.isRefreshing).toBe(false);

    cleanup(root, container);
  });

  describe("concurrent updates", () => {
    it("two execute() calls in the same tick: only the latest result lands in state", async () => {
      const first = makeDeferred<string>();
      const second = makeDeferred<string>();

      const fetcher = vi.fn<() => Promise<string>>()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const { root, container } = renderHarness(
        fetcher as unknown as (args: unknown) => Promise<unknown>,
      );

      let firstPromise!: Promise<unknown>;
      let secondPromise!: Promise<unknown>;
      act(() => {
        firstPromise = latest!.execute(undefined);
        secondPromise = latest!.execute(undefined);
      });

      expect(fetcher).toHaveBeenCalledTimes(2);

      await act(async () => {
        first.resolve("first");
        const firstResult = await firstPromise;
        expect(firstResult).toBeNull();
      });
      expect(latest!.data).toBeNull();

      await act(async () => {
        second.resolve("second");
        const secondResult = await secondPromise;
        expect(secondResult).toBe("second");
      });
      expect(latest!.data).toBe("second");

      cleanup(root, container);
    });

    it("unmount during pending request: no setState after unmount and no toast fires", async () => {
      const deferred = makeDeferred<string>();

      const fetcher = vi.fn<() => Promise<string>>().mockReturnValue(deferred.promise);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { root, container } = renderHarness(
        fetcher as unknown as (args: unknown) => Promise<unknown>,
      );

      let pending!: Promise<unknown>;
      act(() => {
        pending = latest!.execute(undefined);
      });

      act(() => {
        root.unmount();
      });

      await act(async () => {
        deferred.resolve("late");
        const result = await pending;
        expect(result).toBeNull();
      });

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(
        errorSpy.mock.calls.some((call) =>
          call.some(
            (arg) =>
              typeof arg === "string" && arg.includes("unmounted component"),
          ),
        ),
      ).toBe(false);

      errorSpy.mockRestore();
      container.remove();
    });

    it("unmount during pending request that rejects: error toast does NOT fire", async () => {
      const deferred = makeDeferred<string>();
      const fetcher = vi.fn<() => Promise<string>>().mockReturnValue(deferred.promise);

      const { root, container } = renderHarness(
        fetcher as unknown as (args: unknown) => Promise<unknown>,
      );

      let pending!: Promise<unknown>;
      act(() => {
        pending = latest!.execute(undefined);
      });

      act(() => {
        root.unmount();
      });

      await act(async () => {
        deferred.reject(new Error("late failure"));
        const result = await pending;
        expect(result).toBeNull();
      });

      expect(mockShowToast).not.toHaveBeenCalled();
      container.remove();
    });

    it("reset() invalidates an in-flight request: late resolution is dropped", async () => {
      const deferred = makeDeferred<string>();
      const fetcher = vi.fn<() => Promise<string>>().mockReturnValue(deferred.promise);

      const { root, container } = renderHarness(
        fetcher as unknown as (args: unknown) => Promise<unknown>,
      );

      let pending!: Promise<unknown>;
      act(() => {
        pending = latest!.execute(undefined);
      });

      act(() => {
        latest!.reset();
      });

      expect(latest!.data).toBeNull();
      expect(latest!.loading).toBe(false);
      expect(latest!.error).toBeNull();

      await act(async () => {
        deferred.resolve("ignored");
        const result = await pending;
        expect(result).toBeNull();
      });

      expect(latest!.data).toBeNull();
      expect(latest!.loading).toBe(false);

      cleanup(root, container);
    });
  });
});
