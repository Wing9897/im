import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MONITOR_MODE_KEY } from "../../context/MonitorModeContext";
import { wrapBoardProviders } from "../boardTestHarness";
import { ScheduleBoardWidget } from "./ScheduleBoardWidget";
import { ItemsBoardWidget } from "./ItemsBoardWidget";
import { LlmHealthBoardWidget } from "./LlmHealthBoardWidget";

const mockListUserEvents = vi.fn();
const mockListRecurring = vi.fn();
const mockFetchCalendar = vi.fn();
const mockListProfiles = vi.fn();

vi.mock("../../api/userEvents", () => ({
  listUserEventsPage: (...args: unknown[]) => mockListUserEvents(...args),
}));

vi.mock("../../api/recurringSeries", () => ({
  listRecurringSeries: (...args: unknown[]) => mockListRecurring(...args),
}));

vi.mock("../../api/results", () => ({
  fetchCalendarOccurrences: (...args: unknown[]) => mockFetchCalendar(...args),
}));

vi.mock("../../api/llmProfiles", () => ({
  listLlmProfiles: (...args: unknown[]) => mockListProfiles(...args),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock(),
);

vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/context-mocks")).analysisStatusModuleMock(),
);

describe("new board widgets (schedule / items / llm-health)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockListUserEvents.mockReset().mockResolvedValue({
      items: [
        {
          id: "ue-1",
          title: "Kickoff",
          body: "",
          startTime: "2026-08-12T10:00:00.000Z",
          endTime: null,
          location: null,
          origin: "manual",
          source: "user",
          taskId: "",
          worksetId: "__user__",
          createdAt: "2026-08-11T00:00:00Z",
          updatedAt: "2026-08-11T00:00:00Z",
        },
      ],
      totalCount: 1,
      hasMore: false,
    });
    mockListRecurring.mockReset().mockResolvedValue({
      items: [
        {
          id: "ser-1",
          name: "Weekly sync",
          description: null,
          rrule: "FREQ=WEEKLY",
          eventStartTime: null,
          eventEndTime: null,
          eventIsAllDay: false,
          eventLocation: null,
          eventDescription: null,
          eventTimezone: null,
          eventExdates: [],
          eventRdates: [],
          icsUid: null,
          icsSource: null,
          isActive: true,
          worksetId: "__user__",
          parentTaskId: null,
          itemId: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
      totalCount: 1,
      hasMore: false,
    });
    mockFetchCalendar.mockReset().mockResolvedValue([
      {
        id: "item:i1:remind",
        seriesId: "",
        taskName: "",
        title: "Milk",
        startTime: "2026-08-15T00:00:00.000Z",
        endTime: "2026-08-15T23:59:59.000Z",
        isAllDay: true,
        location: null,
        description: null,
        rrule: "",
        source: "item_remind",
        worksetId: "__user__",
        itemId: "i1",
        itemDateKind: "remind",
      },
      {
        id: "rrule:1",
        seriesId: "ser-1",
        title: "Meeting",
        startTime: "2026-08-15T10:00:00.000Z",
        endTime: "2026-08-15T11:00:00.000Z",
        isAllDay: false,
        location: null,
        description: null,
        rrule: "FREQ=WEEKLY",
        source: "recurring",
      },
    ]);
    mockListProfiles.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("ScheduleBoardWidget lists upcoming events and series", async () => {
    act(() => {
      root.render(wrapBoardProviders(createElement(ScheduleBoardWidget)));
    });
    await flush();
    expect(container.querySelector('[data-testid="board-schedule-event-ue-1"]')?.textContent).toContain(
      "Kickoff",
    );
    expect(
      container.querySelector('[data-testid="board-schedule-series-ser-1"]')?.textContent,
    ).toContain("Weekly sync");
    expect(container.querySelector('[data-testid="board-schedule-hint"]')).toBeTruthy();
  });

  it("ItemsBoardWidget shows only item_remind rows", async () => {
    act(() => {
      root.render(wrapBoardProviders(createElement(ItemsBoardWidget)));
    });
    await flush();
    expect(container.querySelector('[data-testid="board-items-row-item:i1:remind"]')).toBeTruthy();
    expect(container.textContent).toContain("Milk");
    expect(container.textContent).not.toContain("Meeting");
    expect(container.querySelector('[data-testid="board-items-hint"]')).toBeTruthy();
  });

  it("LlmHealthBoardWidget alerts when no profiles exist", async () => {
    act(() => {
      root.render(wrapBoardProviders(createElement(LlmHealthBoardWidget)));
    });
    await flush();
    expect(container.querySelector('[data-testid="board-llm-health-alert"]')?.textContent).toMatch(
      /No LLM profiles|尚未配置/,
    );
    expect(container.querySelector('[data-testid="board-llm-health-stats"]')?.textContent).toContain(
      "0",
    );
  });

  it("LlmHealthBoardWidget reports complete + default", async () => {
    mockListProfiles.mockResolvedValue([
      {
        id: "p1",
        name: "Default Ollama",
        provider: "ollama",
        baseUrl: "http://127.0.0.1:11434",
        model: "llama3",
        apiKey: "",
        thinkingEnabled: false,
        jsonMode: "auto",
        webSearchEnabled: false,
        webSearchProvider: "auto",
        braveSearchApiKey: "",
            staffClasses: [],
        staffInstances: [],
        createdAt: null,
        updatedAt: null,
      },
    ]);
    act(() => {
      root.render(wrapBoardProviders(createElement(LlmHealthBoardWidget)));
    });
    await flush();
    expect(container.querySelector('[data-testid="board-llm-health-alert"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-llm-health-default"]')?.textContent).toContain(
      "Default Ollama",
    );
  });
});
