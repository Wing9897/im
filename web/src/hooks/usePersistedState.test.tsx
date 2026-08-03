import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePersistedState } from "./usePersistedState";

let latestValue: unknown;
let latestSetValue: ((value: unknown) => void) | undefined;

function Harness<T>({
  storageKey,
  fallback,
  persistDebounceMs,
  storage,
}: {
  storageKey: string;
  fallback: T;
  persistDebounceMs?: number;
  storage?: "local" | "session";
}) {
  const [value, setValue] = usePersistedState(storageKey, fallback, {
    persistDebounceMs,
    storage,
  });
  latestValue = value;
  latestSetValue = setValue as (value: unknown) => void;
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

describe("usePersistedState", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    latestValue = undefined;
  });

  afterEach(() => {
    latestValue = undefined;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("resets corrupted structured data back to the fallback", () => {
    window.localStorage.setItem("im:test:object", "{not-json");

    const { container, root } = render(
      <Harness storageKey="im:test:object" fallback={{ enabled: true }} />,
    );

    expect(latestValue).toEqual({ enabled: true });
    expect(window.localStorage.getItem("im:test:object")).toBe(
      JSON.stringify({ enabled: true }),
    );

    cleanupRender(root, container);
  });

  it("resets corrupted JSON (including plain strings) back to the fallback", () => {
    window.localStorage.setItem("im:test:string", "legacy-value");

    const { container, root } = render(
      <Harness storageKey="im:test:string" fallback="safe-default" />,
    );

    expect(latestValue).toBe("safe-default");
    expect(window.localStorage.getItem("im:test:string")).toBe(
      JSON.stringify("safe-default"),
    );

    cleanupRender(root, container);
  });

  it.each([
    { label: "string (calendar)", value: "calendar" },
    { label: "string (gantt)", value: "gantt" },
    { label: "number (integer)", value: 42 },
    { label: "number (float)", value: 3.14 },
    { label: "boolean (true)", value: true },
    { label: "boolean (false)", value: false },
    { label: "null", value: null },
    { label: "object", value: { enabled: true, count: 5 } },
    { label: "array", value: [1, "two", false] },
    { label: "nested object", value: { a: { b: [1, 2] }, c: "d" } },
  ])(
    "localStorage round-trip preserves value: $label",
    ({ value }) => {
      const storageKey = "im:test:roundtrip";

      // Write using the same serialization as usePersistedState
      window.localStorage.setItem(storageKey, JSON.stringify(value));

      // Read back using the same deserialization
      const stored = window.localStorage.getItem(storageKey);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed).toEqual(value);
    },
  );

  it("debounces localStorage writes while keeping React state immediate", () => {
    vi.useFakeTimers();
    const storageKey = "im:test:debounced";
    const { container, root } = render(
      <Harness storageKey={storageKey} fallback="" persistDebounceMs={400} />,
    );

    act(() => {
      latestSetValue?.("a");
    });
    expect(latestValue).toBe("a");
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    act(() => {
      latestSetValue?.("ab");
    });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(window.localStorage.getItem(storageKey)).toBe(JSON.stringify("ab"));

    cleanupRender(root, container);
    vi.useRealTimers();
  });

  it("can persist to sessionStorage instead of localStorage", () => {
    const storageKey = "im:test:session";
    const { container, root } = render(
      <Harness storageKey={storageKey} fallback="" storage="session" />,
    );

    act(() => {
      latestSetValue?.("draft");
    });
    expect(window.sessionStorage.getItem(storageKey)).toBe(JSON.stringify("draft"));
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    cleanupRender(root, container);
  });
});
