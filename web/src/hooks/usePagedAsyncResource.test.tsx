import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  usePagedAsyncResource,
  type PagedResourcePage,
  type UsePagedAsyncResourceOptions,
  type UsePagedAsyncResourceResult,
} from "./usePagedAsyncResource";

let latest: UsePagedAsyncResourceResult<{ q: string }, { id: string }> | null =
  null;

function Harness({
  fetchPage,
  options,
}: {
  fetchPage: (
    args: { q: string },
    offset: number,
  ) => Promise<PagedResourcePage<{ id: string }>>;
  options?: UsePagedAsyncResourceOptions<{ id: string }>;
}) {
  latest = usePagedAsyncResource(fetchPage, options);
  return null;
}

function renderHarness(
  fetchPage: (
    args: { q: string },
    offset: number,
  ) => Promise<PagedResourcePage<{ id: string }>>,
  options?: UsePagedAsyncResourceOptions<{ id: string }>,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Harness fetchPage={fetchPage} options={options} />);
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("usePagedAsyncResource", () => {
  beforeEach(() => {
    latest = null;
  });

  afterEach(() => {
    latest = null;
  });

  it("loadFirst settles items and hasMore from page 0", async () => {
    const fetchPage = vi
      .fn<(args: { q: string }, offset: number) => Promise<PagedResourcePage<{ id: string }>>>()
      .mockResolvedValue({
        items: [{ id: "a" }, { id: "b" }],
        hasMore: true,
      });
    const { root, container } = renderHarness(fetchPage);

    await act(async () => {
      await latest!.loadFirst({ q: "x" });
    });

    expect(fetchPage).toHaveBeenCalledWith({ q: "x" }, 0);
    expect(latest!.items).toEqual([{ id: "a" }, { id: "b" }]);
    expect(latest!.hasMore).toBe(true);
    expect(latest!.initialLoading).toBe(false);

    cleanup(root, container);
  });

  it("append uses current length as offset and merges pages", async () => {
    const fetchPage = vi
      .fn<(args: { q: string }, offset: number) => Promise<PagedResourcePage<{ id: string }>>>()
      .mockResolvedValueOnce({
        items: [{ id: "a" }],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: "b" }],
        hasMore: false,
      });
    const { root, container } = renderHarness(fetchPage, {
      mergePages: (existing, incoming) => [...existing, ...incoming],
    });

    await act(async () => {
      await latest!.loadFirst({ q: "x" });
    });
    await act(async () => {
      await latest!.append();
    });

    expect(fetchPage).toHaveBeenLastCalledWith({ q: "x" }, 1);
    expect(latest!.items).toEqual([{ id: "a" }, { id: "b" }]);
    expect(latest!.hasMore).toBe(false);

    cleanup(root, container);
  });

  it("drops a stale first-page response when a newer loadFirst wins", async () => {
    let resolveFirst!: (page: PagedResourcePage<{ id: string }>) => void;
    let resolveSecond!: (page: PagedResourcePage<{ id: string }>) => void;
    const fetchPage = vi.fn(
      (_args: { q: string }, offset: number) => {
        if (offset !== 0) {
          return Promise.resolve({ items: [], hasMore: false });
        }
        return new Promise<PagedResourcePage<{ id: string }>>((resolve) => {
          if (!resolveFirst) resolveFirst = resolve;
          else resolveSecond = resolve;
        });
      },
    );
    const { root, container } = renderHarness(fetchPage);

    let firstPromise!: Promise<unknown>;
    let secondPromise!: Promise<unknown>;
    act(() => {
      firstPromise = latest!.loadFirst({ q: "old" });
      secondPromise = latest!.loadFirst({ q: "new" });
    });

    await act(async () => {
      resolveSecond!({ items: [{ id: "new" }], hasMore: false });
      await secondPromise;
    });
    expect(latest!.items).toEqual([{ id: "new" }]);

    await act(async () => {
      resolveFirst!({ items: [{ id: "stale" }], hasMore: false });
      await firstPromise;
    });
    expect(latest!.items).toEqual([{ id: "new" }]);

    cleanup(root, container);
  });

  it("serializes concurrent appends so the second page is not dropped", async () => {
    let releaseSecond: (() => void) | undefined;
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const fetchPage = vi
      .fn<(args: { q: string }, offset: number) => Promise<PagedResourcePage<{ id: string }>>>()
      .mockResolvedValueOnce({
        items: [{ id: "1" }, { id: "2" }],
        hasMore: true,
      })
      .mockImplementationOnce(async () => {
        await secondGate;
        return { items: [{ id: "3" }], hasMore: true };
      })
      .mockResolvedValueOnce({
        items: [{ id: "4" }],
        hasMore: false,
      });

    const { root, container } = renderHarness(fetchPage);

    await act(async () => {
      await latest!.loadFirst({ q: "x" });
    });

    let firstAppend!: Promise<unknown>;
    let secondAppend!: Promise<unknown>;
    await act(async () => {
      firstAppend = latest!.append();
      secondAppend = latest!.append();
    });

    releaseSecond?.();
    await act(async () => {
      await Promise.all([firstAppend, secondAppend]);
    });

    const offsets = fetchPage.mock.calls
      .map((call) => call[1])
      .filter((offset) => offset > 0);
    expect(offsets).toContain(2);
    expect(latest!.items.map((item) => item.id)).toEqual(["1", "2", "3", "4"]);

    cleanup(root, container);
  });
});
