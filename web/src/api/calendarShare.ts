/**
 * Local IM proxy for the public calendar-share server.
 * Renderer never talks to that origin; tokens stay on the FastAPI host.
 */

import { apiClient } from "./client";

export type CalendarShareVisibility = "off" | "busy" | "details";
export type CalendarShareGrantVisibility = "busy" | "details";

export type CalendarShareGrant = {
  handle: string;
  visibility: CalendarShareGrantVisibility;
};

export type CalendarShareSession = {
  connected: boolean;
  baseUrl: string;
  handle: string;
  status: "disconnected" | "connected";
};

export type CalendarShareTimezone = {
  timezone: string;
  suggestedTimezone: string;
  pendingPublicTimezone: boolean;
  lastPublicTimezone: string;
};

export type CalendarSharePublishState = {
  worksetId: string;
  slug: string;
  enabled: boolean;
  autoSync: boolean;
  publicVisibility: CalendarShareVisibility;
  grants: CalendarShareGrant[];
  lastSyncAt: string | null;
  lastError: string | null;
  isSystemWorkset: boolean;
};

export type CalendarShareSubscription = {
  handle: string;
  slug: string;
};

export type CalendarShareSubscriptions = {
  items: CalendarShareSubscription[];
  ownHandle: string;
};

export type CalendarShareSearchHit = {
  handle: string;
  slug: string;
  visibility: "busy" | "details";
};

export type CalendarShareSearch = {
  items: CalendarShareSearchHit[];
};

export type CalendarShareEvent = {
  id: string;
  source: string;
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  isAllDay?: boolean;
  timezone?: string | null;
  emoji?: string | null;
  body?: string | null;
  handle?: string | null;
  slug?: string | null;
  dismissed?: boolean;
  important?: boolean;
  taskName?: string | null;
  isLastOccurrence?: boolean;
  /** Remote RRULE uid when this row is an expanded series occurrence; omitted/null for one-offs. */
  seriesId?: string | null;
};

export type CalendarShareLoginBody = {
  baseUrl: string;
  handle: string;
  password: string;
};

export type CalendarSharePublishBody = {
  enabled: boolean;
  slug: string;
  autoSync?: boolean;
  publicVisibility?: CalendarShareVisibility;
  grants?: CalendarShareGrant[];
  syncNow?: boolean;
};

export function fetchCalendarShareSession(): Promise<CalendarShareSession> {
  return apiClient.get<CalendarShareSession>("/api/v1/calendar-share/session");
}

export function loginCalendarShare(body: CalendarShareLoginBody): Promise<CalendarShareSession> {
  return apiClient.post<CalendarShareSession>("/api/v1/calendar-share/session", body);
}

export function logoutCalendarShare(): Promise<CalendarShareSession> {
  return apiClient.delete<CalendarShareSession>("/api/v1/calendar-share/session");
}

export function fetchCalendarShareTimezone(): Promise<CalendarShareTimezone> {
  return apiClient.get<CalendarShareTimezone>("/api/v1/calendar-share/timezone");
}

export function putCalendarShareTimezone(timezone: string): Promise<CalendarShareTimezone> {
  return apiClient.put<CalendarShareTimezone>("/api/v1/calendar-share/timezone", { timezone });
}

export function fetchCalendarSharePublish(worksetId: string): Promise<CalendarSharePublishState> {
  return apiClient.get<CalendarSharePublishState>(
    `/api/v1/calendar-share/publish/${encodeURIComponent(worksetId)}`,
  );
}

export function putCalendarSharePublish(
  worksetId: string,
  body: CalendarSharePublishBody,
): Promise<CalendarSharePublishState> {
  return apiClient.put<CalendarSharePublishState>(
    `/api/v1/calendar-share/publish/${encodeURIComponent(worksetId)}`,
    body,
  );
}

export function fetchCalendarShareSubscriptions(): Promise<CalendarShareSubscriptions> {
  return apiClient.get<CalendarShareSubscriptions>("/api/v1/calendar-share/subscriptions");
}

export function fetchCalendarShareSearch(q = ""): Promise<CalendarShareSearch> {
  return apiClient.get<CalendarShareSearch>("/api/v1/calendar-share/search", { q });
}

export function addCalendarShareSubscription(body: {
  handle?: string;
  slug?: string;
  path?: string;
}): Promise<CalendarShareSubscriptions> {
  return apiClient.post<CalendarShareSubscriptions>("/api/v1/calendar-share/subscriptions", body);
}

export function removeCalendarShareSubscription(handle: string, slug: string): Promise<CalendarShareSubscriptions> {
  const params = new URLSearchParams({ handle, slug });
  return apiClient.delete<CalendarShareSubscriptions>(
    `/api/v1/calendar-share/subscriptions?${params.toString()}`,
  );
}

export async function fetchCalendarShareSubscriptionEvents(
  fromIso: string,
  toIso: string,
): Promise<CalendarShareEvent[]> {
  const page = await apiClient.get<{ items: CalendarShareEvent[] }>(
    "/api/v1/calendar-share/subscriptions/events",
    { from: fromIso, to: toIso },
  );
  return page.items;
}
