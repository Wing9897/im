import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useSyncedLocalStorage } from "./useSyncedLocalStorage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = "im:test-synced-storage";
const EVENT = "im:test-synced-storage-change";

function read(): string {
  return window.localStorage.getItem(KEY) ?? "a";
}

function write(value: string): void {
  window.localStorage.setItem(KEY, value);
}

function Harness({
  onReady,
}: {
  onReady: (api: { value: string; setValue: (v: string) => void }) => void;
}) {
  const [value, setValue] = useSyncedLocalStorage({
    key: KEY,
    eventName: EVENT,
    read,
    write,
  });
  onReady({ value, setValue });
  return createElement("div", { "data-value": value });
}

describe("useSyncedLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.removeItem(KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(KEY);
  });

  it("writes and broadcasts so a peer hook updates", async () => {
    const containerA = document.createElement("div");
    const containerB = document.createElement("div");
    document.body.append(containerA, containerB);

    let apiA!: { value: string; setValue: (v: string) => void };
    let apiB!: { value: string; setValue: (v: string) => void };

    await act(async () => {
      createRoot(containerA).render(
        createElement(Harness, { onReady: (api) => { apiA = api; } }),
      );
      createRoot(containerB).render(
        createElement(Harness, { onReady: (api) => { apiB = api; } }),
      );
    });

    expect(apiA.value).toBe("a");
    expect(apiB.value).toBe("a");

    await act(async () => {
      apiA.setValue("b");
    });

    expect(window.localStorage.getItem(KEY)).toBe("b");
    expect(apiA.value).toBe("b");
    expect(apiB.value).toBe("b");

    containerA.remove();
    containerB.remove();
  });
});
