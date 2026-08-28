import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MONITOR_MODE_KEY } from "../../context/MonitorModeContext";
import { wrapBoardProviders } from "../boardTestHarness";
import { ScheduleBoardWidget } from "./ScheduleBoardWidget";
import { ItemsBoardWidget } from "./ItemsBoardWidget";
import { LlmHealthBoardWidget } from "./LlmHealthBoardWidget";
import { emptyKeyedWebSearchApiKeyFields } from "../../domain/settings/assistantWebSearchRoute";

const mockListUserEvents = vi.fn();
const mockListRecurring = vi.fn();
const mockFetchCalendarWindow = vi.fn();
const mockListProfiles = vi.fn();

vi.mock("../../api/userEvents", () => ({
  listUserEventsPage: (...args: unknown[]) => mockListUserEvents(...args),
}));

vi.mock("../../api/recurringSeries", () => ({
  listRecurringSeries: (...args: unknown[]) => mockListRecurring(...args),
}));

vi.mock("../../api/calendarWindow", () => ({
  fetchCalendarWindow: (...args: unknown[]) => mockFetchCalendarWindow(...args),
}));

vi.mock("../../api/llmProfiles", () => ({
  listLlmProfiles: (...args: unknown[]) => mockListProfiles(...args),
  listLlmGlobalSlots: vi.fn(async () => []),
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
          emoji: "🎂",
          startTime: "2026-08-12T10:00:00.000Z",
          endTime: null,
          location: null,
          origin: "manual",
          source: "user",
          taskId: "",
          worksetId: "__general__",
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
          worksetId: "__general__",
          parentTaskId: null,
          itemId: null,
          createdAt: null,
          updatedAt: null,
        },
      ],
      totalCount: 1,
      hasMore: false,
    });
    mockFetchCalendarWindow.mockReset().mockResolvedValue([
      {
        id: "item:i1:remind",
        source: "item_remind",
        title: "Milk",
        startTime: "2026-08-15T00:00:00.000Z",
        endTime: "2026-08-15T23:59:59.000Z",
        isAllDay: true,
        timezone: null,
        emoji: null,
        taskId: null,
        seriesId: null,
        worksetId: "__general__",
        itemId: "i1",
        origin: null,
        itemDateKind: "remind",
        notifyPref: "inherit",
        dismissed: false,
        important: false,
        taskName: null,
        isLastOccurrence: false,
        remindBeforeDays: null,
        body: "",
      },
      {
        id: "rrule:1",
        source: "recurring",
        title: "Meeting",
        startTime: "2026-08-15T10:00:00.000Z",
        endTime: "2026-08-15T11:00:00.000Z",
        isAllDay: false,
        timezone: null,
        emoji: null,
        taskId: null,
        seriesId: "ser-1",
        worksetId: "__general__",
        itemId: null,
        origin: null,
        itemDateKind: null,
        notifyPref: "inherit",
        dismissed: false,
        important: false,
        taskName: null,
        isLastOccurrence: false,
        remindBeforeDays: null,
        body: "",
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
    expect(container.querySelector('[data-testid="board-schedule-event-ue-1"]')?.textContent).toMatch(
      /Kickoff/,
    );
    expect(container.querySelector('[data-testid="board-schedule-event-ue-1"]')?.textContent).toMatch(
      /\d/,
    );
    expect(
      container.querySelector('[data-testid="board-schedule-series-ser-1"]')?.textContent,
    ).toContain("Weekly sync");
    expect(
      container.querySelector('[data-testid="board-schedule-series-ser-1"]')?.textContent,
    ).not.toMatch(/N\/A/);
    expect(
      container
        .querySelector('[data-testid="board-schedule-event-ue-1"] [data-testid="schedule-event-emoji"]')
        ?.textContent,
    ).toContain("🎂");
    expect(
      container
        .querySelector('[data-testid="board-schedule-event-ue-1"] [data-testid="card-title-icon"]'),
    ).toBeNull();
    expect(
      container
        .querySelector('[data-testid="board-schedule-series-ser-1"] [data-testid="card-title-icon"]')
        ?.classList.contains("lucide-repeat"),
    ).toBe(true);
    expect(container.querySelector('[data-testid="board-schedule-hint"]')).toBeTruthy();
  });

  it("ItemsBoardWidget shows only item_remind rows", async () => {
    act(() => {
      root.render(wrapBoardProviders(createElement(ItemsBoardWidget)));
    });
    await flush();
    expect(mockFetchCalendarWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        includeAnalysis: false,
        includeUser: false,
        includeRecurring: false,
        includeItems: true,
      }),
    );
    expect(container.querySelector('[data-testid="board-items-row-item:i1:remind"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-items-kind-item:i1:remind"]')).toBeTruthy();
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
    expect(container.querySelector('[data-testid="board-llm-health-slots"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-llm-slot-assistant"]')).toBeTruthy();
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
        ...emptyKeyedWebSearchApiKeyFields(),
        staffClasses: [],
        staffInstances: [],
        createdAt: null,
        updatedAt: null,
      },
    ]);
    const { listLlmGlobalSlots } = await import("../../api/llmProfiles");
    vi.mocked(listLlmGlobalSlots).mockResolvedValue([
      {
        slot: "assistant",
        profileId: "p1",
        profileName: "Default Ollama",
        profileProvider: "ollama",
        profileModel: "llama3",
      },
      { slot: "liaison", profileId: null, profileName: null, profileProvider: null, profileModel: null },
      { slot: "taskEditor", profileId: null, profileName: null, profileProvider: null, profileModel: null },
    ]);
    act(() => {
      root.render(wrapBoardProviders(createElement(LlmHealthBoardWidget)));
    });
    await flush();
    expect(container.querySelector('[data-testid="board-llm-health-alert"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-llm-slot-assistant"]')?.textContent).toMatch(
      /Default Ollama|Assistant|助手/,
    );
  });
});
