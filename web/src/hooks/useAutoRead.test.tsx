import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoRead } from "./useAutoRead";

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  thresholds: number[];
};

const observerRecords: ObserverRecord[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: number[];
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly takeRecords = vi.fn(() => []);

  constructor(
    public readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.thresholds = Array.isArray(options?.threshold)
      ? [...options.threshold]
      : [0];
    observerRecords.push({
      callback,
      disconnect: this.disconnect,
      observe: this.observe,
      thresholds: this.thresholds,
    });
  }

  unobserve = vi.fn();
}

function TestComponent({
  isRead = false,
  onAutoRead,
}: {
  isRead?: boolean;
  onAutoRead: (id: string) => void;
}) {
  const ref = useAutoRead<HTMLDivElement>({
    itemId: "intel-1",
    isRead,
    delayMs: 250,
    visibilityThreshold: 0.6,
    onAutoRead,
  });

  return <div ref={ref}>item</div>;
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

function triggerIntersection(isIntersecting: boolean, intersectionRatio: number) {
  const observer = observerRecords.at(-1);
  if (!observer) {
    throw new Error("No observer registered");
  }
  const entry: IntersectionObserverEntry = {
    time: Date.now(),
    target: document.createElement("div"),
    rootBounds: null,
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRect: {} as DOMRectReadOnly,
    isIntersecting,
    intersectionRatio,
  };
  act(() => {
    observer.callback(
      [entry],
      {} as IntersectionObserver,
    );
  });
}

describe("useAutoRead", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observerRecords.length = 0;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("marks an unread item as read after it stays visible long enough", () => {
    const onAutoRead = vi.fn();
    const { container, root } = render(<TestComponent onAutoRead={onAutoRead} />);

    triggerIntersection(true, 0.7);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onAutoRead).toHaveBeenCalledWith("intel-1");
    cleanupRender(root, container);
  });

  it("cancels the pending auto-read when visibility drops before the delay", () => {
    const onAutoRead = vi.fn();
    const { container, root } = render(<TestComponent onAutoRead={onAutoRead} />);

    triggerIntersection(true, 0.7);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    triggerIntersection(false, 0.1);
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onAutoRead).not.toHaveBeenCalled();
    cleanupRender(root, container);
  });

  it("registers granular thresholds around the configured visibility threshold", () => {
    const onAutoRead = vi.fn();
    const { container, root } = render(<TestComponent onAutoRead={onAutoRead} />);

    expect(observerRecords.at(-1)?.thresholds).toEqual([0, 0.3, 0.6, 1]);

    cleanupRender(root, container);
  });
});
