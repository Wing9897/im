import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useLatestRequest } from "./useLatestRequest";

let latestHook: ReturnType<typeof useLatestRequest> | null = null;

function Harness() {
  latestHook = useLatestRequest();
  return null;
}

function render(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function cleanupRender(root: Root, container: HTMLElement) {
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

describe("useLatestRequest", () => {
  afterEach(() => {
    latestHook = null;
  });

  it("marks older request versions as stale after a newer request begins", () => {
    const { container, root } = render(<Harness />);
    const first = latestHook!.begin();
    const second = latestHook!.begin();

    expect(latestHook!.isCurrent(first)).toBe(false);
    expect(latestHook!.isCurrent(second)).toBe(true);
    expect(latestHook!.current()).toBe(second);

    cleanupRender(root, container);
  });

  it("keeps the hook object identity stable across rerenders", () => {
    const { container, root } = render(<Harness />);
    const firstHook = latestHook;

    act(() => {
      root.render(<Harness />);
    });

    expect(latestHook).toBe(firstHook);
    cleanupRender(root, container);
  });

  describe("concurrent updates", () => {
    beforeEach(() => {
      latestHook = null;
    });

    afterEach(() => {
      latestHook = null;
    });

    it("two begin() calls in the same tick produce monotonic tokens and only the latest is current", () => {
      const { container, root } = render(<Harness />);

      let first = 0;
      let second = 0;
      act(() => {
        first = latestHook!.begin();
        second = latestHook!.begin();
      });

      expect(second).toBeGreaterThan(first);
      expect(latestHook!.isCurrent(first)).toBe(false);
      expect(latestHook!.isCurrent(second)).toBe(true);

      cleanupRender(root, container);
    });

    it("stale-request guard rejects older async responses after a newer one resolves first", async () => {
      const { container, root } = render(<Harness />);

      const older = makeDeferred<string>();
      const newer = makeDeferred<string>();

      let olderToken = 0;
      let newerToken = 0;

      act(() => {
        olderToken = latestHook!.begin();
      });
      act(() => {
        newerToken = latestHook!.begin();
      });

      await act(async () => {
        newer.resolve("newer");
        await newer.promise;
      });

      expect(latestHook!.isCurrent(newerToken)).toBe(true);
      expect(latestHook!.isCurrent(olderToken)).toBe(false);

      await act(async () => {
        older.resolve("older");
        await older.promise;
      });

      expect(latestHook!.isCurrent(olderToken)).toBe(false);
      expect(latestHook!.isCurrent(newerToken)).toBe(true);

      cleanupRender(root, container);
    });

    it("after unmount the hook handle becomes inert (no observable side effects)", () => {
      const { container, root } = render(<Harness />);

      let token = 0;
      act(() => {
        token = latestHook!.begin();
      });

      const handle = latestHook!;

      act(() => {
        root.unmount();
      });

      expect(() => handle.isCurrent(token)).not.toThrow();
      expect(() => handle.current()).not.toThrow();

      container.remove();
    });
  });
});
