import { resetCalendarShareRateLimitForTests } from "./calendarShareRateLimit.testing";
import { resetCalendarShareCatalogForTests as resetCatalogState } from "../../domain/calendarShare/useCalendarShareCatalog";

export function resetCalendarShareCatalogForTests(): void {
  resetCatalogState();
  resetCalendarShareRateLimitForTests();
}
