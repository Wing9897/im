import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY } from "../domain/prefs";
import { useIdReadTracking } from "./useIdReadTracking";

let latest: ReturnType<typeof useIdReadTracking> | null = null;

function Harness() {
  latest = useIdReadTracking(INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY);
  return null;
}

describe("useIdReadTracking", () => {
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

  it("keeps readIdSet unchanged in-session while marking items consumed", () => {
    act(() => {
      root.render(createElement(Harness));
    });

    expect(latest!.readIdSet.has("intel-1")).toBe(false);
    expect(latest!.isConsumed("intel-1")).toBe(false);

    act(() => {
      latest!.markRead("intel-1");
    });

    expect(latest!.readIdSet.has("intel-1")).toBe(false);
    expect(latest!.isConsumed("intel-1")).toBe(true);
    expect(
      JSON.parse(
        window.localStorage.getItem(INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY) ?? "[]",
      ),
    ).toEqual([]);
  });

  it("persists pending read ids on unmount", () => {
    act(() => {
      root.render(createElement(Harness));
    });

    act(() => {
      latest!.markRead("intel-1");
    });

    act(() => {
      root.unmount();
    });

    expect(
      JSON.parse(
        window.localStorage.getItem(INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY) ?? "[]",
      ),
    ).toEqual(["intel-1"]);
  });

  it("loads persisted read ids for display on mount", () => {
    window.localStorage.setItem(
      INTELLIGENCE_READ_ITEM_IDS_STORAGE_KEY,
      JSON.stringify(["intel-old"]),
    );

    act(() => {
      root.render(createElement(Harness));
    });

    expect(latest!.readIdSet.has("intel-old")).toBe(true);
    expect(latest!.isConsumed("intel-old")).toBe(true);
  });
});
