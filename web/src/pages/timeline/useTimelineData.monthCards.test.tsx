/**
 * Month-cards fetch skip: null filters must not hit the whole library.
 */
import { type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { MemoryRouter } from "react-router-dom";

const {
  mockFetchCalendarWindow,
  mockFetchTaskActivitySpans,
} = vi.hoisted(() => ({
  mockFetchCalendarWindow: vi.fn().mockResolvedValue([]),
  mockFetchTaskActivitySpans: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/calendarWindow", () => ({
  fetchCalendarWindow: (...args: unknown[]) => mockFetchCalendarWindow(...args),
}));

vi.mock("../../api/calendarShare", async () =>
  (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());

vi.mock("../../api/tasks", () => ({
  fetchTaskActivitySpans: (...args: unknown[]) => mockFetchTaskActivitySpans(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/context-mocks")).analysisStatusModuleMock());

import { MonitorModeProvider } from "../../context/MonitorModeContext";
import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
import { resetTaskCatalogState, taskCatalogState } from "../../test/context-mocks";
import type { Workset } from "../../types/worksets";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

function catalogWorkset(id: string, name = id): Workset {
  return {
    id,
    name,
    isSystem: id === SYSTEM_WORKSET_ID,
    notifyEnabled: true,
    externalEnabled: true,
    description: "",
    cover: "",
  };
}
import {
  setupTimelineDataCalendarDom,
  teardownTimelineDataCalendarDom,
  TimelineDataHookHarness,
  type TimelineDataHookResult,
} from "./useTimelineData.calendar.testHarness";

describe("useTimelineData month-cards fetch skip", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let resultRef: { current: TimelineDataHookResult | null };

  async function render(opts: {
    selectedSources: Parameters<typeof TimelineDataHookHarness>[0]["selectedSources"];
    selectedSubscribeKeys?: string[] | null;
    subscribeCatalogKeys?: readonly string[];
    monthCardsMode?: boolean;
  }) {
    await act(async () => {
      root = (await import("react-dom/client")).createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(TimelineDataHookHarness, {
              refOut: resultRef,
              ...opts,
            }),
          ),
        ),
      );
    });
  }

  beforeEach(() => {
    container = setupTimelineDataCalendarDom();
    mockFetchCalendarWindow.mockReset().mockResolvedValue([]);
    mockFetchTaskActivitySpans.mockReset().mockResolvedValue([]);
    resetCalendarShareApiMocks();
    resetTaskCatalogState();
    resultRef = { current: null };
  });

  afterEach(() => {
    teardownTimelineDataCalendarDom(root, container);
    root = null;
  });

  it("does not fetch the library when both-null expansion would exceed 12 cards", async () => {
    taskCatalogState.worksets = Array.from({ length: 13 }, (_, i) =>
      catalogWorkset(`ws-${i}`, `WS ${i}`),
    );
    await render({
      selectedSources: null,
      selectedSubscribeKeys: null,
      subscribeCatalogKeys: ["Alice/Work"],
      monthCardsMode: true,
    });
    expect(mockFetchCalendarWindow).not.toHaveBeenCalled();
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptionEvents).not.toHaveBeenCalled();
    expect(resultRef.current?.events ?? []).toEqual([]);
  });

  it("fetches a small both-null catalog that expands to at most 12 cards", async () => {
    taskCatalogState.worksets = [catalogWorkset(SYSTEM_WORKSET_ID, "一般")];
    await render({
      selectedSources: null,
      selectedSubscribeKeys: null,
      subscribeCatalogKeys: ["Alice/Work"],
      monthCardsMode: true,
    });
    expect(mockFetchCalendarWindow).toHaveBeenCalled();
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptionEvents).toHaveBeenCalled();
  });

  it("skips the local library when only subscribe keys are explicit", async () => {
    await render({
      selectedSources: null,
      selectedSubscribeKeys: ["Alice/Work"],
      subscribeCatalogKeys: ["Alice/Work"],
      monthCardsMode: true,
    });
    expect(mockFetchCalendarWindow).not.toHaveBeenCalled();
    expect(calendarShareApiMocks.fetchCalendarShareSubscriptionEvents).toHaveBeenCalled();
  });

  it("still fetches the unified month window when filters are null", async () => {
    await render({
      selectedSources: null,
      selectedSubscribeKeys: null,
      subscribeCatalogKeys: ["Alice/Work"],
      monthCardsMode: false,
    });
    expect(mockFetchCalendarWindow).toHaveBeenCalled();
  });
});
