import { createContext } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useContextWithFallback } from "./useContextWithFallback";

interface DummyValue {
  count: number;
}

const DummyContext = createContext<DummyValue | null>(null);

let latestValue: DummyValue | null = null;

function DummyHookHarness() {
  latestValue = useContextWithFallback(
    DummyContext,
    "useDummyContext",
    "DummyProvider",
  );
  return null;
}

describe("useContextWithFallback", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    latestValue = null;
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it("throws a descriptive error when used outside provider", () => {
    // Suppress React error boundary console noise
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      act(() => {
        root = createRoot(container);
        root.render(<DummyHookHarness />);
      });
    }).toThrow(
      "useDummyContext must be used within a <DummyProvider>. " +
        "Wrap your component tree with <DummyProvider> to resolve this error.",
    );

    expect(consoleError).toHaveBeenCalled();
  });

  it("returns the provider value when context exists", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    act(() => {
      root = createRoot(container);
      root.render(
        <DummyContext.Provider value={{ count: 3 }}>
          <DummyHookHarness />
        </DummyContext.Provider>,
      );
    });

    expect(latestValue).toEqual({ count: 3 });
    expect(consoleError).not.toHaveBeenCalled();
  });
});
