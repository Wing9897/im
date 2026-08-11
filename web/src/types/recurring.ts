/** Standalone recurring calendar series returned by `/api/v1/calendar/recurring`. */
export type RecurringSeries = {
  id: string;
  name: string;
  description: string | null;
  rrule: string;
  eventStartTime: string | null;
  eventEndTime: string | null;
  eventIsAllDay: boolean;
  eventLocation: string | null;
  eventDescription: string | null;
  eventTimezone: string | null;
  eventExdates: string[];
  eventRdates: string[];
  icsUid: string | null;
  icsSource: string | null;
  isActive: boolean;
  worksetId: string;
  parentTaskId: string | null;
  itemId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type RecurringSeriesPage = {
  items: RecurringSeries[];
  totalCount: number;
  hasMore: boolean;
};

export type RecurringSeriesCreate = {
  name: string;
  rrule: string;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  eventIsAllDay?: boolean;
  eventLocation?: string | null;
  eventDescription?: string | null;
  description?: string | null;
  worksetId?: string | null;
  parentTaskId?: string | null;
  itemId?: string | null;
};

export type RecurringSeriesPatch = Partial<
  Omit<RecurringSeriesCreate, "parentTaskId">
> & {
  isActive?: boolean;
};
