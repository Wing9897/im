import { useMemo, useState } from "react";

import { matchesCalendarShareFilter } from "./subscribedCalendars";

/** Client-side handle/slug/name filter shared by Mine and Published lists. */
export function useSubscribeCatalogFilter<T>(
  items: readonly T[],
  fieldsOf: (row: T) => readonly string[],
  extraKey = "",
): {
  listFilter: string;
  setListFilter: (value: string) => void;
  visible: T[];
  filtering: boolean;
} {
  const [listFilter, setListFilter] = useState("");
  const visible = useMemo(
    () => items.filter((row) => matchesCalendarShareFilter(listFilter, ...fieldsOf(row))),
    // fieldsOf is a render-local picker; extraKey covers closed-over values (e.g. handle).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, listFilter, extraKey],
  );
  return {
    listFilter,
    setListFilter,
    visible,
    filtering: listFilter.trim().length > 0,
  };
}
