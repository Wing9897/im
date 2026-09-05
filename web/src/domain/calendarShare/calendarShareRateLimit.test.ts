import { describe, expect, it } from "vitest";
import {
  CALENDAR_SHARE_RATE_LIMIT_WINDOW_MS,
  CalendarShareRateLimitError,
  consumeCalendarShareRateLimit,
} from "./calendarShareRateLimit";
import { resetCalendarShareRateLimitForTests } from "./calendarShareRateLimit.testing";
describe("calendarShareRateLimit", () => {
  it("allows a subscribe then blocks the next one in the same window", () => {
    resetCalendarShareRateLimitForTests();
    consumeCalendarShareRateLimit("subscribe", 1_000);
    expect(() => consumeCalendarShareRateLimit("subscribe", 1_000)).toThrow(
      CalendarShareRateLimitError,
    );
    expect(() =>
      consumeCalendarShareRateLimit("subscribe", 1_000),
    ).toThrowError("RATE_LIMITED");
  });

  it("does not share budget across action families", () => {
    resetCalendarShareRateLimitForTests();
    consumeCalendarShareRateLimit("subscribe", 1_000);
    consumeCalendarShareRateLimit("unsubscribe", 1_000);
    consumeCalendarShareRateLimit("search", 1_000);
  });

  it("allows two searches in the same window then blocks the third", () => {
    resetCalendarShareRateLimitForTests();
    consumeCalendarShareRateLimit("search", 1_000);
    consumeCalendarShareRateLimit("search", 1_100);
    expect(() => consumeCalendarShareRateLimit("search", 1_200)).toThrow(
      CalendarShareRateLimitError,
    );
  });

  it("refills after the window elapses", () => {
    resetCalendarShareRateLimitForTests();
    consumeCalendarShareRateLimit("subscribe", 1_000);
    consumeCalendarShareRateLimit(
      "subscribe",
      1_000 + CALENDAR_SHARE_RATE_LIMIT_WINDOW_MS,
    );
  });
});
