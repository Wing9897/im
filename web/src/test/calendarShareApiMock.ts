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
  publicVisibility: "private_group" as const,
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
  putCalendarShareProfile: vi.fn(),
  fetchCalendarSharePublish: vi.fn().mockResolvedValue({ ...emptyPublish }),
  fetchCalendarSharePublishList: vi.fn().mockResolvedValue({ items: [] as unknown[] }),
  putCalendarSharePublish: vi.fn(),
  unpublishCalendarSharePublish: vi.fn(),
  syncCalendarSharePublish: vi.fn(),
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
    putCalendarShareProfile: (...args: unknown[]) =>
      calendarShareApiMocks.putCalendarShareProfile(...args),
    fetchCalendarSharePublish: (...args: unknown[]) =>
      calendarShareApiMocks.fetchCalendarSharePublish(...args),
    fetchCalendarSharePublishList: (...args: unknown[]) =>
      calendarShareApiMocks.fetchCalendarSharePublishList(...args),
    putCalendarSharePublish: (...args: unknown[]) =>
      calendarShareApiMocks.putCalendarSharePublish(...args),
    unpublishCalendarSharePublish: (...args: unknown[]) =>
      calendarShareApiMocks.unpublishCalendarSharePublish(...args),
    syncCalendarSharePublish: (...args: unknown[]) =>
      calendarShareApiMocks.syncCalendarSharePublish(...args),
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
  calendarShareApiMocks.putCalendarShareProfile.mockReset();
  calendarShareApiMocks.fetchCalendarSharePublish.mockReset().mockResolvedValue({ ...emptyPublish });
  calendarShareApiMocks.fetchCalendarSharePublishList.mockReset().mockResolvedValue({ items: [] });
  calendarShareApiMocks.putCalendarSharePublish.mockReset();
  calendarShareApiMocks.unpublishCalendarSharePublish.mockReset();
  calendarShareApiMocks.syncCalendarSharePublish.mockReset();
}
