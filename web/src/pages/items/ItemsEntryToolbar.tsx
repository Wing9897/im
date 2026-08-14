import { LayoutGrid, Layers, Tags, Wallet } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, FilterChip, MenuSelect } from "../../components/ui";
import type { Workset } from "../../types/worksets";
import { ItemsChromeSearch } from "./ItemsChromeSearch";
import { ItemsPageChrome } from "./ItemsPageChrome";
import {
  itemsPageChromeFilterChipClass,
  itemsPageChromeIconToggleClass,
  itemsPageChromeIconToggleGroupClass,
  itemsPageChromeEntrySearchWrapClass,
  itemsPageChromeEntryInnerClass,
  itemsPageChromeEntryOuterClass,
  itemsPageChromeEntryControlsClass,
  itemsPageChromeEntryFiltersClass,
  itemsPageChromeEntryToolsClass,
  itemsPageChromeEntryActionsClass,
  itemsPageChromeEntryActionLabelClass,
  itemsPageChromeSelectClass,
} from "./itemsPageChromeClasses";
import { ITEMS_SORT_OPTION_KEYS, type ItemsFilterKey, type ItemsSortKey } from "../../domain/items/itemsListModel";

type Props = {
  listTitle: string;
  filter: ItemsFilterKey;
  search: string;
  sort: ItemsSortKey;
  /** When true, entry list sections by workset; default false = flat cards. */
  groupByWorkset: boolean;
  worksetFilterId: string | null;
  worksets: readonly Workset[];
  onFilterChange: (key: ItemsFilterKey) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (key: ItemsSortKey) => void;
  onGroupByWorksetChange: (value: boolean) => void;
  onWorksetFilterChange: (worksetId: string | null) => void;
  onBack: () => void;
  onAddItem: () => void;
  onManageCategories: () => void;
  onOpenFinance?: () => void;
};

/** Entry-list top strip — back · title · filters · search · layout · sort · actions. */
export function ItemsEntryToolbar({
  listTitle,
  filter,
  search,
  sort,
  groupByWorkset,
  worksetFilterId,
  worksets,
  onFilterChange,
  onSearchChange,
  onSortChange,
  onGroupByWorksetChange,
  onWorksetFilterChange,
  onBack,
  onAddItem,
  onManageCategories,
  onOpenFinance,
}: Props) {
  const { t } = useTranslation("items");
  const sortOptions = useMemo(
    () => ITEMS_SORT_OPTION_KEYS.map(([value, labelKey]) => ({ value, label: t(labelKey) })),
    [t],
  );
  const worksetOptions = useMemo(
    () => [
      { value: "", label: t("filterWorksetAll") },
      ...worksets.map((ws) => ({ value: ws.id, label: ws.name })),
    ],
    [worksets, t],
  );

  return (
    <ItemsPageChrome
      title={listTitle}
      back={{ onClick: onBack, ariaLabel: t("backToCategories") }}
      controlsAriaLabel={t("filterBarAria")}
      innerClassName={itemsPageChromeEntryInnerClass}
      outerClassName={itemsPageChromeEntryOuterClass}
      controlsClassName={itemsPageChromeEntryControlsClass}
      actionsClassName={itemsPageChromeEntryActionsClass}
      controls={
        <>
          <div className={itemsPageChromeEntryFiltersClass}>
            {(
              [
                ["all", "filterAll"],
                ["expiring", "filterExpiring"],
                ["overdue", "filterOverdue"],
                ["archived", "filterArchived"],
              ] as const
            ).map(([key, labelKey]) => (
              <FilterChip
                key={key}
                size="sm"
                active={filter === key}
                className={itemsPageChromeFilterChipClass}
                onClick={() => onFilterChange(key)}
              >
                {t(labelKey)}
              </FilterChip>
            ))}
          </div>
          <div className={itemsPageChromeEntryToolsClass}>
            <ItemsChromeSearch
              value={search}
              onChange={onSearchChange}
              ariaKey="searchAria"
              wrapClassName={itemsPageChromeEntrySearchWrapClass}
              data-testid="items-entry-search"
            />
            <MenuSelect
              variant="toolbar"
              menuPortal
              className="min-w-[6.5rem]"
              triggerClassName={itemsPageChromeSelectClass}
              value={worksetFilterId ?? ""}
              options={worksetOptions}
              onChange={(value) => onWorksetFilterChange(value ? value : null)}
              aria-label={t("filterWorksetAria")}
              data-testid="items-entry-workset-filter"
            />
            <div
              className={itemsPageChromeIconToggleGroupClass}
              role="group"
              aria-label={t("layoutModeAria")}
              data-testid="items-layout-toggle"
            >
              <button
                type="button"
                className={itemsPageChromeIconToggleClass}
                data-active={!groupByWorkset ? "true" : "false"}
                aria-pressed={!groupByWorkset}
                aria-label={t("layoutCardsOnly")}
                title={t("layoutCardsOnly")}
                data-testid="items-layout-cards"
                onClick={() => onGroupByWorksetChange(false)}
              >
                <LayoutGrid size={14} strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                className={itemsPageChromeIconToggleClass}
                data-active={groupByWorkset ? "true" : "false"}
                aria-pressed={groupByWorkset}
                aria-label={t("layoutGroupByWorkset")}
                title={t("layoutGroupByWorkset")}
                data-testid="items-layout-worksets"
                onClick={() => onGroupByWorksetChange(true)}
              >
                <Layers size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <MenuSelect
              variant="toolbar"
              menuPortal
              className="min-w-[6rem]"
              triggerClassName={itemsPageChromeSelectClass}
              value={sort}
              options={sortOptions}
              onChange={(value) => onSortChange(value as ItemsSortKey)}
              aria-label={t("sortAria")}
              data-testid="items-entry-sort"
            />
          </div>
        </>
      }
      actions={
        <>
          {onOpenFinance ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenFinance}
              aria-label={t("finance.openAria")}
              title={t("finance.open")}
              data-testid="items-entry-finance"
            >
              <Wallet size={14} strokeWidth={2} aria-hidden />
              <span className={itemsPageChromeEntryActionLabelClass}>{t("finance.open")}</span>
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={onManageCategories}
            aria-label={t("manageCategories")}
            title={t("manageCategories")}
          >
            <Tags size={14} strokeWidth={2} aria-hidden />
            <span className={itemsPageChromeEntryActionLabelClass}>
              {t("manageCategories")}
            </span>
          </Button>
          <Button variant="primary" size="sm" onClick={onAddItem} data-testid="items-entry-add">
            {t("addItem")}
          </Button>
        </>
      }
      data-testid="items-entry-toolbar"
    />
  );
}
