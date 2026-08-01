import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInfiniteScroll } from "./useInfiniteScroll";

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------

let observerCallback: IntersectionObserverCallback | null = null;
let observerOptions: IntersectionObserverInit | undefined;
const observeMock = vi.fn();
const disconnectMock = vi.fn();

const unobserveMock = vi.fn();

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observerCallback = callback;
    observerOptions = options;
  }
  observe = observeMock;
  unobserve = unobserveMock;
  disconnect = disconnectMock;
  takeRecords = vi.fn().mockReturnValue([]);
  root = null;
  rootMargin = "";
  thresholds = [0];
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function Harness({
  triggerNode,
  onLoadMore,
  disabled,
  root: rootOpt,
  rootMargin,
}: {
  triggerNode: HTMLElement | null;
  onLoadMore: () => void;
  disabled?: boolean;
  root?: Element | null;
  rootMargin?: string;
}) {
  useInfiniteScroll({ triggerNode, onLoadMore, disabled, root: rootOpt, rootMargin });
  return null;
}

describe("useInfiniteScroll", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      },
    );
    observerCallback = null;
    observerOptions = undefined;
    observeMock.mockClear();
    unobserveMock.mockClear();
    disconnectMock.mockClear();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("observes the trigger node and calls onLoadMore when intersecting", async () => {
    const triggerNode = document.createElement("div");
    const onLoadMore = vi.fn();

    act(() => {
      root.render(<Harness triggerNode={triggerNode} onLoadMore={onLoadMore} />);
    });

    expect(observeMock).toHaveBeenCalledWith(triggerNode);
    expect(observerOptions?.rootMargin).toBe("0px 0px 240px 0px");

    await act(async () => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    // Must not reobserve — that would chain loads while the sentinel stays visible.
    expect(unobserveMock).not.toHaveBeenCalled();
    expect(observeMock).toHaveBeenCalledTimes(1);
  });

  it("ignores concurrent intersections while a load is in flight", async () => {
    const triggerNode = document.createElement("div");
    let resolveLoad!: () => void;
    const onLoadMore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    act(() => {
      root.render(<Harness triggerNode={triggerNode} onLoadMore={onLoadMore} />);
    });

    act(() => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    act(() => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveLoad();
      await Promise.resolve();
    });
  });

  it("does not auto-chain while the sentinel stays intersecting", async () => {
    const triggerNode = document.createElement("div");
    const onLoadMore = vi.fn();

    act(() => {
      root.render(<Harness triggerNode={triggerNode} onLoadMore={onLoadMore} />);
    });

    await act(async () => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
    });
    await act(async () => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("re-arms after the sentinel leaves so the next scroll-in can load", async () => {
    const triggerNode = document.createElement("div");
    const onLoadMore = vi.fn();

    act(() => {
      root.render(<Harness triggerNode={triggerNode} onLoadMore={onLoadMore} />);
    });

    await act(async () => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
    });
    act(() => {
      observerCallback!(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    await act(async () => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
    });

    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it("does not observe when triggerNode is null", () => {
    const onLoadMore = vi.fn();

    act(() => {
      root.render(<Harness triggerNode={null} onLoadMore={onLoadMore} />);
    });

    expect(observeMock).not.toHaveBeenCalled();
  });

  it("does not observe when disabled is true", () => {
    const triggerNode = document.createElement("div");
    const onLoadMore = vi.fn();

    act(() => {
      root.render(
        <Harness triggerNode={triggerNode} onLoadMore={onLoadMore} disabled={true} />,
      );
    });

    expect(observeMock).not.toHaveBeenCalled();
  });

  it("disconnects the observer on unmount", () => {
    const triggerNode = document.createElement("div");
    const onLoadMore = vi.fn();

    act(() => {
      root.render(<Harness triggerNode={triggerNode} onLoadMore={onLoadMore} />);
    });

    act(() => {
      root.unmount();
    });

    expect(disconnectMock).toHaveBeenCalled();
  });

  it("auto-detects a vertical scroll parent when root is omitted", () => {
    const scrollRoot = document.createElement("div");
    scrollRoot.style.overflowY = "auto";
    const triggerNode = document.createElement("div");
    scrollRoot.appendChild(triggerNode);
    document.body.appendChild(scrollRoot);

    const onLoadMore = vi.fn();

    act(() => {
      root.render(<Harness triggerNode={triggerNode} onLoadMore={onLoadMore} />);
    });

    expect(observerOptions?.root).toBe(scrollRoot);

    scrollRoot.remove();
  });

  it("uses the provided rootMargin option", () => {
    const triggerNode = document.createElement("div");
    const onLoadMore = vi.fn();

    act(() => {
      root.render(
        <Harness triggerNode={triggerNode} onLoadMore={onLoadMore} rootMargin="100px 0px" />,
      );
    });

    expect(observerOptions?.rootMargin).toBe("100px 0px");
  });

  it("does not call onLoadMore when entry is not intersecting", () => {
    const triggerNode = document.createElement("div");
    const onLoadMore = vi.fn();

    act(() => {
      root.render(<Harness triggerNode={triggerNode} onLoadMore={onLoadMore} />);
    });

    // Simulate non-intersection
    act(() => {
      observerCallback!(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("keeps the observer when onLoadMore identity changes", async () => {
    const triggerNode = document.createElement("div");
    const first = vi.fn();
    const second = vi.fn();

    act(() => {
      root.render(<Harness triggerNode={triggerNode} onLoadMore={first} />);
    });
    expect(observeMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).not.toHaveBeenCalled();

    act(() => {
      root.render(<Harness triggerNode={triggerNode} onLoadMore={second} />);
    });

    expect(disconnectMock).not.toHaveBeenCalled();
    expect(observeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      observerCallback!(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
