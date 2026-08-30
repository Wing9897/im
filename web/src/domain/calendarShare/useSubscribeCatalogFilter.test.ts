import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { calendarShareKey } from "./subscribedCalendars";
import { useSubscribeCatalogFilter } from "./useSubscribeCatalogFilter";

type Row = { handle: string; slug: string };

function Probe({
  items,
  onResult,
}: {
  items: Row[];
  onResult: (value: ReturnType<typeof useSubscribeCatalogFilter<Row>>) => void;
}) {
  const result = useSubscribeCatalogFilter(items, (row) => [
    row.handle,
    row.slug,
    calendarShareKey(row.handle, row.slug),
  ]);
  onResult(result);
  return null;
}

describe("useSubscribeCatalogFilter", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useSubscribeCatalogFilter<Row>> | null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("filters by handle, slug, or key", () => {
    act(() => {
      root.render(
        createElement(Probe, {
          items: [
            { handle: "Alice", slug: "Work" },
            { handle: "DemoPub", slug: "Open" },
          ],
          onResult: (value) => {
            latest = value;
          },
        }),
      );
    });
    expect(latest?.visible).toHaveLength(2);
    act(() => latest?.setListFilter("alice"));
    expect(latest?.visible.map((row) => row.slug)).toEqual(["Work"]);
    expect(latest?.filtering).toBe(true);
  });
});
