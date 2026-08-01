import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSourceListTab } from "./useSourceListTab";

type Item = { id: string };

let latest: ReturnType<typeof useSourceListTab<Item>> | null = null;

function Harness({
  listFn,
  removeFn,
}: {
  listFn: () => Promise<Item[]>;
  removeFn: (target: Item) => Promise<void>;
}) {
  latest = useSourceListTab({ listFn, removeFn });
  return null;
}

describe("useSourceListTab load phases", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("uses initialLoading on first fetch and clears it when items arrive", async () => {
    let resolveList: (items: Item[]) => void;
    const listFn = vi.fn(
      () =>
        new Promise<Item[]>((resolve) => {
          resolveList = resolve;
        }),
    );
    const removeFn = vi.fn(async () => {});

    act(() => {
      root.render(<Harness listFn={listFn} removeFn={removeFn} />);
    });

    expect(latest!.initialLoading).toBe(true);
    expect(latest!.isRefreshing).toBe(false);
    expect(latest!.items).toEqual([]);

    await act(async () => {
      resolveList!([{ id: "a" }]);
      await Promise.resolve();
    });

    expect(latest!.initialLoading).toBe(false);
    expect(latest!.items).toEqual([{ id: "a" }]);
  });

  it("ignores an older request that resolves after a newer refresh", async () => {
    const resolvers: Array<(items: Item[]) => void> = [];
    const listFn = vi.fn(
      () =>
        new Promise<Item[]>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const removeFn = vi.fn(async () => {});

    act(() => {
      root.render(<Harness listFn={listFn} removeFn={removeFn} />);
    });
    act(() => {
      void latest!.fetchItems();
    });

    await act(async () => {
      resolvers[1]!([{ id: "new" }]);
      await Promise.resolve();
    });
    expect(latest!.items).toEqual([{ id: "new" }]);

    await act(async () => {
      resolvers[0]!([{ id: "stale" }]);
      await Promise.resolve();
    });
    expect(latest!.items).toEqual([{ id: "new" }]);
  });

  it("uses isRefreshing on refetch while keeping cached items visible", async () => {
    let call = 0;
    let resolveSecond: (items: Item[]) => void;
    const listFn = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return [{ id: "a" }];
      }
      return new Promise<Item[]>((resolve) => {
        resolveSecond = resolve;
      });
    });
    const removeFn = vi.fn(async () => {});

    act(() => {
      root.render(<Harness listFn={listFn} removeFn={removeFn} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(latest!.items).toEqual([{ id: "a" }]);
    expect(latest!.initialLoading).toBe(false);

    act(() => {
      void latest!.fetchItems();
    });

    expect(latest!.initialLoading).toBe(false);
    expect(latest!.isRefreshing).toBe(true);
    expect(latest!.items).toEqual([{ id: "a" }]);

    await act(async () => {
      resolveSecond!([{ id: "a" }, { id: "b" }]);
      await Promise.resolve();
    });

    expect(latest!.isRefreshing).toBe(false);
    expect(latest!.items).toEqual([{ id: "a" }, { id: "b" }]);
  });
});
