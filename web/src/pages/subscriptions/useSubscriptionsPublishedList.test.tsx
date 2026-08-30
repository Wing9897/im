import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Workset } from "../../api/worksets";
import type { TaskCatalogContextValue } from "../../context/TaskCatalogContext";

const optionalCatalog = vi.hoisted(() => ({
  current: null as TaskCatalogContextValue | null,
}));

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../api/worksets", () => ({
  listWorksets: vi.fn(),
}));

vi.mock("../../context/TaskCatalogContext", () => ({
  useOptionalTaskCatalog: () => optionalCatalog.current,
}));

import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { listWorksets } from "../../api/worksets";
import {
  useSubscriptionsPublishedList,
} from "./useSubscriptionsPublishedList";

const WORKSET: Workset = {
  id: "ws-1",
  name: "Ops",
  isSystem: false,
  notifyEnabled: true,
  externalEnabled: true,
  cover: "data:image/jpeg;base64,cover",
  description: "Ops calendar",
  createdAt: "",
  updatedAt: "",
};

const CATALOG_WORKSET: Workset = {
  ...WORKSET,
  name: "Ops renamed",
  cover: "data:image/jpeg;base64,fresh",
};

const LIVE = {
  worksetId: "ws-1",
  slug: "Ops",
  publicVisibility: "public_busy" as const,
  grants: [],
  lastSyncAt: null,
  lastError: null,
  pendingSync: false,
  autoSync: true,
  autoSyncIntervalSeconds: 60,
  isSystemWorkset: false,
  worksetName: "Ops",
  worksetMissing: false,
  cover: "data:image/jpeg;base64,cover",
  description: "Ops calendar",
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
  refOut: { current: ReturnType<typeof useSubscriptionsPublishedList> | null };
}) {
  refOut.current = useSubscriptionsPublishedList();
  return null;
}

describe("useSubscriptionsPublishedList", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: ReturnType<typeof useSubscriptionsPublishedList> | null };

  beforeEach(() => {
    optionalCatalog.current = null;
    resetCalendarShareApiMocks();
    vi.mocked(listWorksets).mockReset().mockResolvedValue([WORKSET]);
    calendarShareApiMocks.fetchCalendarSharePublishList.mockResolvedValue({ items: [LIVE] });
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
    expect(resultRef.current?.items).toHaveLength(1);
  });

  it("uses TaskCatalog worksets and skips listWorksets when the provider is mounted", async () => {
    optionalCatalog.current = catalogValue([CATALOG_WORKSET]);
    await renderHook();
    expect(listWorksets).not.toHaveBeenCalled();
    expect(resultRef.current?.worksets).toEqual([CATALOG_WORKSET]);
    expect(resultRef.current?.worksets[0]?.name).toBe("Ops renamed");
    expect(calendarShareApiMocks.fetchCalendarSharePublishList).toHaveBeenCalledTimes(1);
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
    expect(resultRef.current?.worksets[0]?.name).toBe("Ops renamed");
    expect(resultRef.current?.worksets[0]?.cover).toBe("data:image/jpeg;base64,fresh");
  });
});
