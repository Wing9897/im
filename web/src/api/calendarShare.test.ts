import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  addCalendarShareSubscription,
  fetchCalendarShareSearch,
  fetchCalendarShareSession,
  fetchCalendarShareSubscriptionEvents,
  fetchCalendarShareTimezone,
  loginCalendarShare,
  putCalendarSharePublish,
  putCalendarShareTimezone,
  fetchCalendarSharePublishList,
  unpublishCalendarSharePublish,
  syncCalendarSharePublish,
  CALENDAR_SHARE_PUBLISH_TIMEOUT_MS,
} from "./calendarShare";
import {
  CalendarShareRateLimitError,
  resetCalendarShareRateLimitForTests,
} from "../domain/calendarShare/calendarShareRateLimit";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("calendarShare API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCalendarShareRateLimitForTests();
  });

  it("GETs and PUTs timezone", async () => {
    const payload = {
      timezone: "Asia/Hong_Kong",
      suggestedTimezone: "Asia/Hong_Kong",
      pendingPublicTimezone: true,
      lastPublicTimezone: "",
    };
    vi.mocked(apiClient.get).mockResolvedValue(payload);
    await expect(fetchCalendarShareTimezone()).resolves.toEqual(payload);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar-share/timezone");

    vi.mocked(apiClient.put).mockResolvedValue({ ...payload, pendingPublicTimezone: false });
    await putCalendarShareTimezone("Asia/Taipei");
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/calendar-share/timezone", {
      timezone: "Asia/Taipei",
    });
  });

  it("GETs session", async () => {
    const payload = {
      connected: false,
      baseUrl: "http://127.0.0.1:8787",
      handle: "",
      status: "disconnected" as const,
    };
    vi.mocked(apiClient.get).mockResolvedValue(payload);
    await expect(fetchCalendarShareSession()).resolves.toEqual(payload);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar-share/session");
  });

  it("POSTs login", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      connected: true,
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      status: "connected",
    });
    await loginCalendarShare({
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      password: "x",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/calendar-share/session", {
      baseUrl: "http://127.0.0.1:8787",
      handle: "Wing",
      password: "x",
    });
  });

  it("PUTs publish mapping", async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ slug: "Work" });
    await putCalendarSharePublish("ws-1", { slug: "Work", syncNow: true });
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/calendar-share/publish/ws-1", {
      slug: "Work",
      syncNow: true,
    }, { timeoutMs: CALENDAR_SHARE_PUBLISH_TIMEOUT_MS });
  });

  it("GETs publish list and unpublishes without extra payload", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] });
    await expect(fetchCalendarSharePublishList()).resolves.toEqual({ items: [] });
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar-share/publish");

    vi.mocked(apiClient.delete).mockResolvedValue({ slug: "Work" });
    await unpublishCalendarSharePublish({
      worksetId: "ws-1",
    });
    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/calendar-share/publish/ws-1", {
      timeoutMs: CALENDAR_SHARE_PUBLISH_TIMEOUT_MS,
    });

    resetCalendarShareRateLimitForTests();
    vi.mocked(apiClient.put).mockResolvedValue({ slug: "Work" });
    await syncCalendarSharePublish({
      worksetId: "ws-1",
      slug: "Work",
      publicVisibility: "public_busy",
      grants: [],
    });
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/calendar-share/publish/ws-1", {
      slug: "Work",
      publicVisibility: "public_busy",
      grants: [],
      syncNow: true,
    }, { timeoutMs: CALENDAR_SHARE_PUBLISH_TIMEOUT_MS });
  });

  it("POSTs subscription and GETs events", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ items: [], ownHandle: "Wing" });
    await addCalendarShareSubscription({ path: "Alice/Work" });
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/calendar-share/subscriptions", {
      path: "Alice/Work",
    });

    vi.mocked(apiClient.get).mockResolvedValue({ items: [] });
    await fetchCalendarShareSubscriptionEvents("a", "b");
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar-share/subscriptions/events", {
      from: "a",
      to: "b",
    });
  });

  it("GETs calendar search", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      items: [{ handle: "DemoPub", slug: "Open", hitKind: "listing", publicVisibility: "public" }],
    });
    await expect(fetchCalendarShareSearch("Demo")).resolves.toEqual({
      items: [{ handle: "DemoPub", slug: "Open", hitKind: "listing", publicVisibility: "public" }],
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/calendar-share/search", { q: "Demo" });
  });

  it("blocks a second immediate subscribe without sending another request", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ items: [], ownHandle: "Wing" });
    await addCalendarShareSubscription({ path: "Alice/Work" });
    await expect(addCalendarShareSubscription({ path: "Bob/Work" })).rejects.toBeInstanceOf(
      CalendarShareRateLimitError,
    );
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("allows a recommended search plus one query then blocks the next search", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [] });
    await fetchCalendarShareSearch("");
    await fetchCalendarShareSearch("Alice");
    await expect(fetchCalendarShareSearch("Bob")).rejects.toBeInstanceOf(CalendarShareRateLimitError);
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });
});
