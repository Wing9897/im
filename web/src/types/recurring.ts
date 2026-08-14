/** Standalone recurring calendar series — OpenAPI wire aliases. */

import type { components } from "../api/generated/schema";

export type RecurringSeries = components["schemas"]["RecurringSeriesResponse"];
export type RecurringSeriesPage = components["schemas"]["RecurringSeriesPageResponse"];
/** OpenAPI marks ``eventIsAllDay`` required (@default); writers may omit it. */
export type RecurringSeriesCreate = Omit<
  components["schemas"]["RecurringSeriesCreateBody"],
  "eventIsAllDay"
> & {
  eventIsAllDay?: boolean;
};
export type RecurringSeriesPatch = components["schemas"]["RecurringSeriesPatchBody"];
