import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Workset } from "../../api/worksets";
import type { TaskCatalogContextValue } from "../../context/TaskCatalogContext";

const optionalCatalog = vi.hoisted(() => ({
  current: null as TaskCatalogContextValue | null,
}));

const stableT = vi.hoisted(() => (key: string) => key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: stableT }),
}));

vi.mock("../../api/items", () => ({
  listItems: vi.fn(),
  listItemCategories: vi.fn(),
}));

vi.mock("../../api/worksets", () => ({
  listWorksets: vi.fn(),
}));

vi.mock("../../context/TaskCatalogContext", () => ({
  useOptionalTaskCatalog: () => optionalCatalog.current,
}));

vi.mock("../../domain/sse/resourceModified", () => ({
  subscribeResourceModified: vi.fn(() => () => undefined),
}));

import { listItemCategories, listItems } from "../../api/items";
import { listWorksets } from "../../api/worksets";
import { useItemsData } from "./useItemsData";

const WORKSET: Workset = {
  id: "__general__",
  name: "General",
  isSystem: true,
  notifyEnabled: true,
  externalEnabled: true,
  cover: "",
  description: "",
  createdAt: "",
  updatedAt: "",
};

const CATALOG_WORKSET: Workset = {
  ...WORKSET,
  name: "General renamed",
};

function catalogValue(worksets: Workset[]): TaskCatalogContextValue {
  return {
    tasks: [],
    tasksLoading: false,
    taskLoadError: null,
    refreshTasks: vi.fn(async () => []),
    worksets,
    worksetsLoading: false,
    refreshWorksets: vi.fn(async () => worksets),
  };
}

function Harness({
  refOut,
}: {
  refOut: { current: ReturnType<typeof useItemsData> | null };
}) {
  refOut.current = useItemsData();
  return null;
}

describe("useItemsData", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: ReturnType<typeof useItemsData> | null };

  beforeEach(() => {
    optionalCatalog.current = null;
    vi.mocked(listItems).mockReset().mockResolvedValue([]);
    vi.mocked(listItemCategories).mockReset().mockResolvedValue([]);
    vi.mocked(listWorksets).mockReset().mockResolvedValue([WORKSET]);
    container = document.createElement("div");
    document.body.appendChild(container);
    resultRef = { current: null };
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    optionalCatalog.current = null;
  });

  async function renderHook() {
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(Harness, { refOut: resultRef }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("falls back to listWorksets when TaskCatalog is not mounted", async () => {
    await renderHook();
    expect(listWorksets).toHaveBeenCalledTimes(1);
    expect(resultRef.current?.worksets).toEqual([WORKSET]);
    expect(listItems).toHaveBeenCalledTimes(1);
    expect(listItemCategories).toHaveBeenCalledTimes(1);
  });

  it("uses TaskCatalog worksets and skips listWorksets when the provider is mounted", async () => {
    optionalCatalog.current = catalogValue([CATALOG_WORKSET]);
    await renderHook();
    expect(listWorksets).not.toHaveBeenCalled();
    expect(resultRef.current?.worksets).toEqual([CATALOG_WORKSET]);
    expect(resultRef.current?.worksets[0]?.name).toBe("General renamed");
    expect(listItems).toHaveBeenCalledTimes(1);
  });

  it("keeps catalog workset names after a rename without refetching listWorksets", async () => {
    optionalCatalog.current = catalogValue([WORKSET]);
    await renderHook();
    expect(listWorksets).not.toHaveBeenCalled();
    optionalCatalog.current = catalogValue([CATALOG_WORKSET]);
    await act(async () => {
      root!.render(createElement(Harness, { refOut: resultRef }));
      await Promise.resolve();
    });
    expect(listWorksets).not.toHaveBeenCalled();
    expect(resultRef.current?.worksets[0]?.name).toBe("General renamed");
  });
});
