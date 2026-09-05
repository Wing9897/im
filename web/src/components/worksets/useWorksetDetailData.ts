import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  listItemCategories,
  listItems,
  type ItemCategory,
  type TrackableItem,
} from "../../api/items";
import { listUserEventsPage, type UserEvent } from "../../api/userEvents";
import { formatItemsError } from "../../domain/items/itemErrors";
import { resolveItemEmoji } from "../../domain/items/itemCalendarProjection";
import { subscribeResourceModified } from "../../domain/sse/resourceModified";
import {
  selectSummaryExpiringItems,
  selectSummaryUserEvents,
  worksetEventsQueryWindow,
} from "../../domain/worksets/worksetDetailSummary";

/** Loads and projects the item/calendar data shown on the workset contents tab. */
export function useWorksetDetailData(worksetId: string) {
  const { t } = useTranslation();
  const { t: tItems } = useTranslation("items");
  const [items, setItems] = useState<TrackableItem[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoadingItems(true);
      setItemsError(null);
      void Promise.all([listItems({ worksetId }), listItemCategories()])
        .then(([rows, nextCategories]) => {
          if (!cancelled) {
            setItems(rows);
            setCategories(nextCategories);
          }
        })
        .catch((error) => {
          if (!cancelled) setItemsError(formatItemsError(error, tItems));
        })
        .finally(() => {
          if (!cancelled) setLoadingItems(false);
        });
    };
    load();
    const unsubscribe = subscribeResourceModified((detail) => {
      if (detail.resourceType === "item" || detail.resourceType === "item_category") load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // Translation functions are stable in production; worksetId is the load key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksetId]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLoadingEvents(true);
      setEventsError(null);
      const { startTime, endTime } = worksetEventsQueryWindow();
      void listUserEventsPage({ worksetId, startTime, endTime })
        .then((page) => {
          if (!cancelled) setEvents(page.items);
        })
        .catch(() => {
          if (!cancelled) setEventsError(t("workset:detailSummaryEventsError"));
        })
        .finally(() => {
          if (!cancelled) setLoadingEvents(false);
        });
    };
    load();
    const unsubscribe = subscribeResourceModified((detail) => {
      if (detail.resourceType === "user_event") load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // Translation functions are stable in production; worksetId is the load key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksetId]);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  return {
    items,
    events,
    loadingItems,
    loadingEvents,
    itemsError,
    eventsError,
    activeItems: items.filter((item) => item.status !== "archived"),
    expiringSummary: selectSummaryExpiringItems(items),
    eventsSummary: selectSummaryUserEvents(events),
    itemEmoji: (item: TrackableItem) =>
      resolveItemEmoji(
        item,
        item.categoryId ? categoryById.get(item.categoryId) ?? null : null,
      ),
  };
}
