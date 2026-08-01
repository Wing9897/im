import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFormSubmit } from "./useFormSubmit";

// ---------------------------------------------------------------------------
// Test harness — exposes the latest hook return value to assertions.
// ---------------------------------------------------------------------------
let latest: ReturnType<typeof useFormSubmit> | null = null;

function Harness() {
  latest = useFormSubmit();
  return null;
}

function renderHarness() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness />);
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

// ---------------------------------------------------------------------------
// Error-path tests for async form submission
// ---------------------------------------------------------------------------
describe("useFormSubmit — error paths", () => {
  beforeEach(() => {
    latest = null;
  });

  afterEach(() => {
    latest = null;
  });

  it("network failure: captures Error message and resets submitting", async () => {
    const { container, root } = renderHarness();

    // Action rejects synchronously with a network-style failure.
    const failingAction = vi.fn(() =>
      Promise.reject(new Error("Network request failed")),
    );

    await act(async () => {
      await latest!.handleSubmit(failingAction);
    });

    expect(failingAction).toHaveBeenCalledTimes(1);
    expect(latest!.submitting).toBe(false);
    expect(latest!.error).toBe("Network request failed");

    cleanup(root, container);
  });

  it("invalid response (string thrown): coerces non-Error to readable message", async () => {
    const { container, root } = renderHarness();

    // Some backend commands reject with raw strings rather than Error
    // instances when the backend returns a structured failure payload.
    const action = vi.fn(() => Promise.reject("Invalid response shape"));

    await act(async () => {
      await latest!.handleSubmit(action);
    });

    expect(latest!.submitting).toBe(false);
    expect(latest!.error).toBe("Invalid response shape");

    cleanup(root, container);
  });

  it("submitting flag is true while the action is in flight, false afterward", async () => {
    const { container, root } = renderHarness();

    let rejectAction: (reason: unknown) => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectAction = reject;
        }),
    );

    let pending: Promise<void>;
    act(() => {
      pending = latest!.handleSubmit(action);
    });

    // Mid-flight: submitting should be true.
    expect(latest!.submitting).toBe(true);
    expect(latest!.error).toBeNull();

    await act(async () => {
      rejectAction(new Error("timeout: backend did not respond"));
      await pending!;
    });

    expect(latest!.submitting).toBe(false);
    expect(latest!.error).toBe("timeout: backend did not respond");

    cleanup(root, container);
  });

  it("clearError resets the error captured from a previous failure", async () => {
    const { container, root } = renderHarness();

    await act(async () => {
      await latest!.handleSubmit(() =>
        Promise.reject(new Error("first failure")),
      );
    });
    expect(latest!.error).toBe("first failure");

    act(() => {
      latest!.clearError();
    });
    expect(latest!.error).toBeNull();

    cleanup(root, container);
  });

  it("recovery: a successful submit after a failure clears the previous error", async () => {
    const { container, root } = renderHarness();

    await act(async () => {
      await latest!.handleSubmit(() =>
        Promise.reject(new Error("transient backend error")),
      );
    });
    expect(latest!.error).toBe("transient backend error");

    await act(async () => {
      await latest!.handleSubmit(() => Promise.resolve());
    });

    expect(latest!.submitting).toBe(false);
    expect(latest!.error).toBeNull();

    cleanup(root, container);
  });

  it("does not crash when the action throws synchronously inside the async wrapper", async () => {
    const { container, root } = renderHarness();

    // Synchronous throw inside the action is wrapped by the async function,
    // so it surfaces as a rejected promise. The hook must not crash.
    const action = vi.fn(async () => {
      throw new Error("sync throw");
    });

    await act(async () => {
      await latest!.handleSubmit(action);
    });

    expect(latest!.submitting).toBe(false);
    expect(latest!.error).toBe("sync throw");

    cleanup(root, container);
  });
});
