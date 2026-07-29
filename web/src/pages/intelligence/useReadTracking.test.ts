import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useReadTracking } from "./useReadTracking";

let latest: ReturnType<typeof useReadTracking> | null = null;

function Harness() {
  latest = useReadTracking();
  return null;
}

describe("useReadTracking", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = null;
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps readIntelligenceIdSet unchanged in-session while marking items consumed", () => {
    act(() => {
      root.render(createElement(Harness));
    });

    expect(latest!.readIntelligenceIdSet.has("intel-1")).toBe(false);
    expect(latest!.isConsumed("intel-1")).toBe(false);

    act(() => {
      latest!.handleAutoRead("intel-1");
    });

    expect(latest!.readIntelligenceIdSet.has("intel-1")).toBe(false);
    expect(latest!.isConsumed("intel-1")).toBe(true);
    expect(
      JSON.parse(
        window.localStorage.getItem("im:intelligence:read-item-ids") ?? "[]",
      ),
    ).toEqual([]);
  });

  it("persists pending read ids on unmount", () => {
    act(() => {
      root.render(createElement(Harness));
    });

    act(() => {
      latest!.handleAutoRead("intel-1");
    });

    act(() => {
      root.unmount();
    });

    expect(
      JSON.parse(
        window.localStorage.getItem("im:intelligence:read-item-ids") ?? "[]",
      ),
    ).toEqual(["intel-1"]);
  });

  it("loads persisted read ids for display on mount", () => {
    window.localStorage.setItem(
      "im:intelligence:read-item-ids",
      JSON.stringify(["intel-old"]),
    );

    act(() => {
      root.render(createElement(Harness));
    });

    expect(latest!.readIntelligenceIdSet.has("intel-old")).toBe(true);
    expect(latest!.isConsumed("intel-old")).toBe(true);
  });
});
