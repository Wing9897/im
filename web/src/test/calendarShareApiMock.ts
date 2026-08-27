/**
 * Shared `vi.mock("../../api/calendarShare")` module shape for timeline / catalog tests.
 *
 * ```ts
 * vi.mock("../../api/calendarShare", async () =>
 *   (await import("../../test/calendarShareApiMock")).calendarShareApiModuleMock());
 *
 * import { calendarShareApiMocks, resetCalendarShareApiMocks } from "../../test/calendarShareApiMock";
 * ```
 */
import { vi } from "vitest";

export const calendarShareApiMocks = {
  fetchCalendarShareSubscriptionEvents: vi.fn().mockResolvedValue([] as unknown[]),
  fetchCalendarShareSubscriptions: vi.fn().mockResolvedValue({ items: [] as unknown[], ownHandle: "" }),
  fetchCalendarShareSession: vi.fn().mockResolvedValue({
    connected: false,
    baseUrl: "http://127.0.0.1:8787",
    handle: "",
    status: "disconnected" as const,
  }),
  fetchCalendarShareSearch: vi.fn().mockResolvedValue({ items: [] as unknown[] }),
  addCalendarShareSubscription: vi.fn(),
  removeCalendarShareSubscription: vi.fn(),
};

/** Module-shape mock for `vi.mock("<path>/api/calendarShare", ...)`. */
export function calendarShareApiModuleMock() {
  return {
    fetchCalendarShareSubscriptionEvents: (...args: unknown[]) =>
      calendarShareApiMocks.fetchCalendarShareSubscriptionEvents(...args),
    fetchCalendarShareSubscriptions: (...args: unknown[]) =>
      calendarShareApiMocks.fetchCalendarShareSubscriptions(...args),
    fetchCalendarShareSession: (...args: unknown[]) =>
      calendarShareApiMocks.fetchCalendarShareSession(...args),
    fetchCalendarShareSearch: (...args: unknown[]) =>
      calendarShareApiMocks.fetchCalendarShareSearch(...args),
    addCalendarShareSubscription: (...args: unknown[]) =>
      calendarShareApiMocks.addCalendarShareSubscription(...args),
    removeCalendarShareSubscription: (...args: unknown[]) =>
      calendarShareApiMocks.removeCalendarShareSubscription(...args),
  };
}

export function resetCalendarShareApiMocks(): void {
  calendarShareApiMocks.fetchCalendarShareSubscriptionEvents.mockReset().mockResolvedValue([]);
  calendarShareApiMocks.fetchCalendarShareSubscriptions.mockReset().mockResolvedValue({
    items: [],
    ownHandle: "",
  });
  calendarShareApiMocks.fetchCalendarShareSession.mockReset().mockResolvedValue({
    connected: false,
    baseUrl: "http://127.0.0.1:8787",
    handle: "",
    status: "disconnected",
  });
  calendarShareApiMocks.fetchCalendarShareSearch.mockReset().mockResolvedValue({ items: [] });
  calendarShareApiMocks.addCalendarShareSubscription.mockReset();
  calendarShareApiMocks.removeCalendarShareSubscription.mockReset();
}
