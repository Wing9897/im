import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listItems } from "../../../api/items";
import { listUserEventsPage } from "../../../api/userEvents";
import {
  buildItemsFinanceRows,
  filterItemsFinanceRows,
  financeEventsQueryWindow,
  financePresetRange,
  sortItemsFinanceRows,
  summarizeItemsFinance,
  type ItemsFinancePlFilter,
  type ItemsFinancePreset,
  type ItemsFinanceRange,
  type ItemsFinanceSortKey,
} from "../../../domain/items/itemFinance";
import { formatItemsError } from "../../../domain/items/itemErrors";

export function useItemsFinancePage() {
  const { t } = useTranslation("items");

  const [preset, setPreset] = useState<ItemsFinancePreset>("thisMonth");
  const [range, setRange] = useState<ItemsFinanceRange>(() => financePresetRange("thisMonth"));
  const [plFilter, setPlFilter] = useState<ItemsFinancePlFilter>("all");
  const [sort, setSort] = useState<ItemsFinanceSortKey>("purchaseDateDesc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<ReturnType<typeof buildItemsFinanceRows>>([]);

  const applyPreset = useCallback((next: ItemsFinancePreset) => {
    setPreset(next);
    if (next !== "custom") {
      setRange(financePresetRange(next));
    }
  }, []);

  const setStartDay = useCallback((startDay: string) => {
    setPreset("custom");
    setRange((prev) => ({ ...prev, startDay }));
  }, []);

  const setEndDay = useCallback((endDay: string) => {
    setPreset("custom");
    setRange((prev) => ({ ...prev, endDay }));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const window = financeEventsQueryWindow(range);
      const [items, events] = await Promise.all([
        listItems(),
        listUserEventsPage({ start: window.start, end: window.end }).then(
          (page) => page.items,
        ),
      ]);
      setRawRows(buildItemsFinanceRows(items, events, range));
    } catch (err) {
      setError(formatItemsError(err, t));
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  }, [range, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = useMemo(
    () => sortItemsFinanceRows(filterItemsFinanceRows(rawRows, plFilter), sort),
    [rawRows, plFilter, sort],
  );
  const summary = useMemo(() => summarizeItemsFinance(rows), [rows]);

  return {
    t,
    preset,
    range,
    plFilter,
    sort,
    loading,
    error,
    rows,
    summary,
    applyPreset,
    setStartDay,
    setEndDay,
    setPlFilter,
    setSort,
    reload,
  };
}
