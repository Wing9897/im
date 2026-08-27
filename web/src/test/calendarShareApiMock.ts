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

const disconnectedSession = {
  connected: false,
  baseUrl: "http://127.0.0.1:8787",
  handle: "",
  status: "disconnected" as const,
};

const emptyPublish = {
  worksetId: "",
  slug: "",
  enabled: false,
  autoSync: false,
  publicVisibility: "off" as const,
  grants: [] as unknown[],
  lastSyncAt: null,
  lastError: null,
  isSystemWorkset: false,
};

const emptyTimezone = {
  timezone: "",
  suggestedTimezone: "",
  pendingPublicTimezone: false,
  lastPublicTimezone: "",
};

export const calendarShareApiMocks = {
  fetchCalendarShareSubscriptionEvents: vi.fn().mockResolvedValue([] as unknown[]),
  fetchCalendarShareSubscriptions: vi.fn().mockResolvedValue({ items: [] as unknown[], ownHandle: "" }),
  fetchCalendarShareSession: vi.fn().mockResolvedValue({ ...disconnectedSession }),
  fetchCalendarShareSearch: vi.fn().mockResolvedValue({ items: [] as unknown[] }),
  addCalendarShareSubscription: vi.fn(),
  removeCalendarShareSubscription: vi.fn(),
  fetchCalendarShareTimezone: vi.fn().mockResolvedValue({ ...emptyTimezone }),
  loginCalendarShare: vi.fn(),
  logoutCalendarShare: vi.fn(),
  putCalendarShareTimezone: vi.fn(),
  fetchCalendarSharePublish: vi.fn().mockResolvedValue({ ...emptyPublish }),
  putCalendarSharePublish: vi.fn(),
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
    fetchCalendarShareTimezone: (...args: unknown[]) =>
      calendarShareApiMocks.fetchCalendarShareTimezone(...args),
    loginCalendarShare: (...args: unknown[]) => calendarShareApiMocks.loginCalendarShare(...args),
    logoutCalendarShare: (...args: unknown[]) => calendarShareApiMocks.logoutCalendarShare(...args),
    putCalendarShareTimezone: (...args: unknown[]) =>
      calendarShareApiMocks.putCalendarShareTimezone(...args),
    fetchCalendarSharePublish: (...args: unknown[]) =>
      calendarShareApiMocks.fetchCalendarSharePublish(...args),
    putCalendarSharePublish: (...args: unknown[]) =>
      calendarShareApiMocks.putCalendarSharePublish(...args),
  };
}

export function resetCalendarShareApiMocks(): void {
  calendarShareApiMocks.fetchCalendarShareSubscriptionEvents.mockReset().mockResolvedValue([]);
  calendarShareApiMocks.fetchCalendarShareSubscriptions.mockReset().mockResolvedValue({
    items: [],
    ownHandle: "",
  });
  calendarShareApiMocks.fetchCalendarShareSession.mockReset().mockResolvedValue({ ...disconnectedSession });
  calendarShareApiMocks.fetchCalendarShareSearch.mockReset().mockResolvedValue({ items: [] });
  calendarShareApiMocks.addCalendarShareSubscription.mockReset();
  calendarShareApiMocks.removeCalendarShareSubscription.mockReset();
  calendarShareApiMocks.fetchCalendarShareTimezone.mockReset().mockResolvedValue({ ...emptyTimezone });
  calendarShareApiMocks.loginCalendarShare.mockReset();
  calendarShareApiMocks.logoutCalendarShare.mockReset();
  calendarShareApiMocks.putCalendarShareTimezone.mockReset();
  calendarShareApiMocks.fetchCalendarSharePublish.mockReset().mockResolvedValue({ ...emptyPublish });
  calendarShareApiMocks.putCalendarSharePublish.mockReset();
}
