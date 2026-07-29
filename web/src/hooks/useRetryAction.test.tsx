import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRetryAction } from "./useRetryAction";

let latestRetrying: boolean;
let latestHandleRetry: () => void;

function Harness({ asyncFn }: { asyncFn: () => Promise<void> }) {
  const { retrying, handleRetry } = useRetryAction(asyncFn);
  latestRetrying = retrying;
  latestHandleRetry = handleRetry;
  return null;
}

describe("useRetryAction", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("should return retrying=false initially", () => {
    const asyncFn = vi.fn().mockResolvedValue(undefined);

    act(() => {
      root.render(<Harness asyncFn={asyncFn} />);
    });

    expect(latestRetrying).toBe(false);
  });

  it("should set retrying=true during execution and false after success", async () => {
    let resolve: () => void;
    const asyncFn = vi.fn(
      () => new Promise<void>((r) => { resolve = r; }),
    );

    act(() => {
      root.render(<Harness asyncFn={asyncFn} />);
    });

    let retryPromise: Promise<void> | undefined;
    act(() => {
      retryPromise = latestHandleRetry() as unknown as Promise<void>;
    });

    expect(latestRetrying).toBe(true);

    await act(async () => {
      resolve!();
      await retryPromise;
    });

    expect(latestRetrying).toBe(false);
    expect(asyncFn).toHaveBeenCalledTimes(1);
  });

  it("should set retrying=false after async function throws", async () => {
    const asyncFn = vi.fn().mockRejectedValue(new Error("fail"));

    act(() => {
      root.render(<Harness asyncFn={asyncFn} />);
    });

    await act(async () => {
      try {
        await latestHandleRetry();
      } catch {
        // Error is expected to propagate (requirement 2.3)
      }
    });

    expect(latestRetrying).toBe(false);
    expect(asyncFn).toHaveBeenCalledTimes(1);
  });

  it("should prevent duplicate calls while retrying", async () => {
    let resolve: () => void;
    const asyncFn = vi.fn(
      () => new Promise<void>((r) => { resolve = r; }),
    );

    act(() => {
      root.render(<Harness asyncFn={asyncFn} />);
    });

    let retryPromise: Promise<void> | undefined;
    act(() => {
      retryPromise = latestHandleRetry() as unknown as Promise<void>;
    });

    // Try calling again while retrying — should be a no-op
    act(() => {
      latestHandleRetry();
    });

    expect(asyncFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve!();
      await retryPromise;
    });

    expect(latestRetrying).toBe(false);
  });
});
