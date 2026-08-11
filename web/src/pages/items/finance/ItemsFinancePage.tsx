import { Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AlertBanner, Button, MenuSelect, TextField } from "../../../components/ui";
import { EmptyState } from "../../../components/common/EmptyState";
import { SkeletonScreen } from "../../../components/common/SkeletonScreen";
import { contentFadeClass } from "../../../components/ui/pageLayout";
import { formatDateOnly } from "../../../utils/dateFormat";
import { ItemsPageChrome } from "../ItemsPageChrome";
import {
  itemsFormPageMaxWidthClass,
  itemsPageChromeEntryToolsClass,
  itemsPageChromeSelectClass,
  itemsPageFillClass,
} from "../itemsPageChromeClasses";
import type { ItemsFinancePlFilter, ItemsFinancePreset, ItemsFinanceSortKey } from "../../../domain/items/itemFinance";
import { useItemsFinancePage } from "./useItemsFinancePage";

const PRESET_KEYS: ItemsFinancePreset[] = ["thisMonth", "last30", "thisYear", "custom"];

const PL_FILTER_KEYS: ItemsFinancePlFilter[] = ["all", "withAmount", "missingAmount"];

const SORT_KEYS: ItemsFinanceSortKey[] = [
  "purchaseDateDesc",
  "purchaseDateAsc",
  "amountDesc",
  "amountAsc",
];

export function ItemsFinancePage() {
  const navigate = useNavigate();
  const {
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
  } = useItemsFinancePage();

  const presetOptions = PRESET_KEYS.map((value) => ({
    value,
    label: t(`finance.preset.${value}`),
  }));

  const plOptions = PL_FILTER_KEYS.map((value) => ({
    value,
    label: t(`finance.plFilter.${value}`),
  }));

  const sortOptions = SORT_KEYS.map((value) => ({
    value,
    label: t(`finance.sort.${value}`),
  }));

  const paneClass = `im-animate-in min-w-0 ${contentFadeClass}`;

  return (
    <div className={itemsPageFillClass} data-testid="items-finance-page">
      <ItemsPageChrome
        title={t("finance.pageTitle")}
        back={{
          onClick: () => navigate("/items"),
          ariaLabel: t("backToCategories"),
        }}
        controlsAriaLabel={t("finance.controlsAria")}
        controls={
          <div className={itemsPageChromeEntryToolsClass}>
            <MenuSelect
              variant="toolbar"
              menuPortal
              className="min-w-[7rem]"
              triggerClassName={itemsPageChromeSelectClass}
              value={preset}
              options={presetOptions}
              onChange={(value) => applyPreset(value as ItemsFinancePreset)}
              aria-label={t("finance.presetAria")}
              data-testid="items-finance-preset"
            />
            <TextField
              type="date"
              className="w-auto text-xs"
              value={range.startDay}
              onChange={(e) => setStartDay(e.target.value)}
              aria-label={t("finance.startDate")}
              data-testid="items-finance-start"
            />
            <span className="text-xs text-text-muted" aria-hidden>
              —
            </span>
            <TextField
              type="date"
              className="w-auto text-xs"
              value={range.endDay}
              onChange={(e) => setEndDay(e.target.value)}
              aria-label={t("finance.endDate")}
              data-testid="items-finance-end"
            />
            <MenuSelect
              variant="toolbar"
              menuPortal
              className="min-w-[6.5rem]"
              triggerClassName={itemsPageChromeSelectClass}
              value={plFilter}
              options={plOptions}
              onChange={(value) => setPlFilter(value as ItemsFinancePlFilter)}
              aria-label={t("finance.plFilterAria")}
              data-testid="items-finance-pl-filter"
            />
            <MenuSelect
              variant="toolbar"
              menuPortal
              className="min-w-[6.5rem]"
              triggerClassName={itemsPageChromeSelectClass}
              value={sort}
              options={sortOptions}
              onChange={(value) => setSort(value as ItemsFinanceSortKey)}
              aria-label={t("finance.sortAria")}
              data-testid="items-finance-sort"
            />
          </div>
        }
        data-testid="items-finance-toolbar"
      />

      <div className="im-auto-scrollbar min-h-0 overflow-y-auto">
        <div
          className={`mx-auto w-full min-w-0 px-page-x py-md max-[780px]:px-sm max-[780px]:py-sm ${itemsFormPageMaxWidthClass}`}
        >
          {error ? (
            <AlertBanner variant="error" role="alert">
              {error}
            </AlertBanner>
          ) : null}

          {loading ? (
            <div className="min-h-[12rem]" aria-busy="true">
              <SkeletonScreen variant="card-grid" count={4} columns={2} />
            </div>
          ) : null}

          {!loading ? (
            <div className={paneClass} data-testid="items-finance-pane">
              <div
                className="mb-md flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border/60 bg-surface/40 px-md py-sm"
                data-testid="items-finance-summary"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wallet size={16} strokeWidth={2} aria-hidden />
                  {t("finance.summaryTitle")}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                  <span>{t("finance.summaryCount", { count: summary.rowCount })}</span>
                  <span>{t("finance.summaryWithAmount", { count: summary.withAmountCount })}</span>
                  <span>{t("finance.summaryExpense", { total: summary.totalExpense.toFixed(2) })}</span>
                  <span>{t("finance.summaryIncome", { total: summary.totalIncome.toFixed(2) })}</span>
                  <span className="font-medium text-text-primary">
                    {t("finance.summaryNet", { total: summary.net.toFixed(2) })}
                  </span>
                </div>
              </div>

              {rows.length === 0 ? (
                <EmptyState
                  compact
                  title={t("finance.emptyTitle")}
                  description={t("finance.emptyHint")}
                  illustration={
                    <Wallet size={22} color="var(--accent)" strokeWidth={1.5} aria-hidden />
                  }
                  actions={
                    <Button variant="secondary" size="sm" onClick={() => navigate("/items")}>
                      {t("backToCategories")}
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <table className="w-full min-w-[36rem] text-left text-sm" data-testid="items-finance-table">
                    <thead className="border-b border-border/60 bg-surface/50 text-xs text-text-muted">
                      <tr>
                        <th className="px-md py-2 font-medium">{t("finance.colItem")}</th>
                        <th className="px-md py-2 font-medium">{t("finance.colPurchase")}</th>
                        <th className="px-md py-2 font-medium">{t("finance.colEvent")}</th>
                        <th className="px-md py-2 font-medium">{t("finance.colDirection")}</th>
                        <th className="px-md py-2 font-medium text-right">{t("finance.colAmount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const dayMs = Date.parse(`${row.purchaseDay}T12:00:00`);
                        const purchaseLabel = Number.isFinite(dayMs)
                          ? formatDateOnly(dayMs) || row.purchaseDay
                          : row.purchaseDay;
                        return (
                          <tr
                            key={row.eventId}
                            className="border-b border-border/40 last:border-0 hover:bg-surface/30"
                          >
                            <td className="px-md py-2">
                              <button
                                type="button"
                                className="text-left font-medium text-accent hover:underline"
                                onClick={() => navigate(`/items/${encodeURIComponent(row.itemId)}/edit`)}
                              >
                                {row.title}
                              </button>
                            </td>
                            <td className="px-md py-2 text-text-secondary">{purchaseLabel}</td>
                            <td className="px-md py-2 text-text-secondary">{row.purchaseEventTitle}</td>
                            <td className="px-md py-2 text-text-secondary">
                              {row.direction
                                ? t(`finance.direction.${row.direction}`)
                                : t("emptyValue")}
                            </td>
                            <td className="px-md py-2 text-right tabular-nums">
                              {row.amount != null && Number.isFinite(row.amount)
                                ? row.amount.toFixed(2)
                                : t("emptyValue")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
