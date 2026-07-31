import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { usePersistedViewMode } from "./usePersistedState";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let latestValue: string | null = null;

function Harness({ storageKey, fallback }: { storageKey: string; fallback?: "card" | "list" | "map" }) {
  const [viewMode] = usePersistedViewMode(storageKey, fallback);
  latestValue = viewMode;
  return null;
}

describe("usePersistedViewMode", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    latestValue = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
  });

  it("success path: returns the fallback when localStorage is empty", () => {
    act(() => {
      root.render(<Harness storageKey="test:viewMode" fallback="list" />);
    });

    expect(latestValue).toBe("list");
  });

  it("success path: returns stored valid view mode from localStorage", () => {
    window.localStorage.setItem("test:viewMode", JSON.stringify("map"));

    act(() => {
      root.render(<Harness storageKey="test:viewMode" fallback="card" />);
    });

    expect(latestValue).toBe("map");
  });

  it("error path: resets to fallback when localStorage contains an invalid view mode", () => {
    window.localStorage.setItem("test:viewMode", JSON.stringify("invalid-mode"));

    act(() => {
      root.render(<Harness storageKey="test:viewMode" fallback="card" />);
    });

    expect(latestValue).toBe("card");
  });

  it("defaults to 'card' fallback when no fallback is specified", () => {
    act(() => {
      root.render(<Harness storageKey="test:viewMode" />);
    });

    expect(latestValue).toBe("card");
  });
});
