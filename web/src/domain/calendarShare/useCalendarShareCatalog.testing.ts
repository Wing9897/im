import { resetCalendarShareRateLimitForTests } from "./calendarShareRateLimit.testing";
import { resetCalendarShareCatalogForTests as resetCatalogState } from "./useCalendarShareCatalog";

export function resetCalendarShareCatalogForTests(): void {
  resetCatalogState();
  resetCalendarShareRateLimitForTests();
}
