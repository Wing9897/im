/**
 * Local IM proxy for the public calendar-share server.
 * Renderer never talks to that origin; tokens stay on the FastAPI host.
 * Shapes come from generated OpenAPI (`schema.d.ts`).
 */

import {
  consumeCalendarShareRateLimit,
  type CalendarShareActionFamily,
} from "../domain/calendarShare/calendarShareRateLimit";
import { apiClient } from "./client";
import type { components } from "./generated/schema";

async function guarded<T>(family: CalendarShareActionFamily, run: () => Promise<T>): Promise<T> {
  consumeCalendarShareRateLimit(family);
  return run();
}

export type CalendarShareGrant = components["schemas"]["CalendarShareGrantResponse"];
export type CalendarShareGrantVisibility = CalendarShareGrant["visibility"];
export type CalendarShareVisibility = components["schemas"]["CalendarSharePublishStateResponse"]["publicVisibility"];
export type CalendarShareSession = components["schemas"]["CalendarShareSessionResponse"];
export type CalendarShareTimezone = components["schemas"]["CalendarShareTimezoneResponse"];
export type CalendarSharePublishState = components["schemas"]["CalendarSharePublishStateResponse"];
export type CalendarSharePublishListItem = components["schemas"]["CalendarSharePublishListItemResponse"];
export type CalendarSharePublishList = components["schemas"]["CalendarSharePublishListResponse"];
export type CalendarShareSubscription = components["schemas"]["CalendarShareSubscriptionResponse"];
export type CalendarShareSubscriptions = components["schemas"]["CalendarShareSubscriptionsResponse"];
export type CalendarShareSearchHit = components["schemas"]["CalendarShareSearchHitResponse"];
export type CalendarShareSearch = components["schemas"]["CalendarShareSearchResponse"];
export type CalendarShareProfile = components["schemas"]["CalendarShareProfileResponse"];
export type CalendarShareEvent = components["schemas"]["CalendarShareEventResponse"];
export type CalendarShareLoginBody = components["schemas"]["CalendarShareLoginBody"];
export type CalendarSharePublishBody = components["schemas"]["CalendarSharePublishBody"];
export type CalendarSharePublishAutoSyncBody = components["schemas"]["CalendarSharePublishAutoSyncBody"];

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

export function putCalendarShareProfile(avatar: string): Promise<CalendarShareProfile> {
  return apiClient.put<CalendarShareProfile>("/api/v1/calendar-share/profile", { avatar });
}

export function fetchCalendarSharePublish(worksetId: string): Promise<CalendarSharePublishState> {
  return guarded("publishList", () =>
    apiClient.get<CalendarSharePublishState>(
      `/api/v1/calendar-share/publish/${encodeURIComponent(worksetId)}`,
    ),
  );
}

export function fetchCalendarSharePublishList(): Promise<CalendarSharePublishList> {
  return guarded("publishList", () =>
    apiClient.get<CalendarSharePublishList>("/api/v1/calendar-share/publish"),
  );
}

export const CALENDAR_SHARE_PUBLISH_TIMEOUT_MS = 90_000;

export function putCalendarSharePublish(
  worksetId: string,
  body: CalendarSharePublishBody,
): Promise<CalendarSharePublishState> {
  return guarded("publish", () =>
    apiClient.put<CalendarSharePublishState>(
      `/api/v1/calendar-share/publish/${encodeURIComponent(worksetId)}`,
      body,
      { timeoutMs: CALENDAR_SHARE_PUBLISH_TIMEOUT_MS },
    ),
  );
}

export function patchCalendarSharePublishAutoSync(
  body: CalendarSharePublishAutoSyncBody,
): Promise<CalendarSharePublishList> {
  return guarded("publish", () =>
    apiClient.patch<CalendarSharePublishList>("/api/v1/calendar-share/publish/auto-sync", body),
  );
}

/** DELETE the IC slug calendar and drop the local publish row. Does not delete the local workset. */
export function unpublishCalendarSharePublish(
  state: Pick<CalendarSharePublishState, "worksetId">,
): Promise<CalendarSharePublishState> {
  return guarded("publish", () =>
    apiClient.delete<CalendarSharePublishState>(
      `/api/v1/calendar-share/publish/${encodeURIComponent(state.worksetId)}`,
      { timeoutMs: CALENDAR_SHARE_PUBLISH_TIMEOUT_MS },
    ),
  );
}

/** Push the current mapping to IC (incremental hash PUT/PATCH). Local workset must still exist. */
export function syncCalendarSharePublish(
  state: Pick<CalendarSharePublishState, "worksetId" | "slug" | "publicVisibility" | "grants">,
): Promise<CalendarSharePublishState> {
  return putCalendarSharePublish(state.worksetId, {
    slug: state.slug,
    publicVisibility: state.publicVisibility,
    grants: state.grants ?? [],
    syncNow: true,
  });
}

export function fetchCalendarShareSubscriptions(): Promise<CalendarShareSubscriptions> {
  return apiClient.get<CalendarShareSubscriptions>("/api/v1/calendar-share/subscriptions");
}

export function fetchCalendarShareSearch(q = ""): Promise<CalendarShareSearch> {
  return guarded("search", () => apiClient.get<CalendarShareSearch>("/api/v1/calendar-share/search", { q }));
}

export function addCalendarShareSubscription(body: {
  handle?: string;
  slug?: string;
  path?: string;
}): Promise<CalendarShareSubscriptions> {
  return guarded("subscribe", () =>
    apiClient.post<CalendarShareSubscriptions>("/api/v1/calendar-share/subscriptions", body),
  );
}

export function removeCalendarShareSubscription(handle: string, slug: string): Promise<CalendarShareSubscriptions> {
  const params = new URLSearchParams({ handle, slug });
  return guarded("unsubscribe", () =>
    apiClient.delete<CalendarShareSubscriptions>(
      `/api/v1/calendar-share/subscriptions?${params.toString()}`,
    ),
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
  return page.items ?? [];
}
