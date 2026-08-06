import { LayoutGrid, Layers, Tags } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, FilterChip, SelectField } from "../../components/ui";
import { ItemsChromeSearch } from "./ItemsChromeSearch";
import { ItemsPageChrome } from "./ItemsPageChrome";
import {
  itemsPageChromeFilterChipClass,
  itemsPageChromeIconToggleClass,
  itemsPageChromeIconToggleGroupClass,
  itemsPageChromeSelectClass,
} from "./itemsPageChromeClasses";
import type { ItemsFilterKey, ItemsSortKey } from "./itemsListModel";

type Props = {
  listTitle: string;
  filter: ItemsFilterKey;
  search: string;
  sort: ItemsSortKey;
  /** When true, entry list sections by workset; default false = flat cards. */
  groupByWorkset: boolean;
  onFilterChange: (key: ItemsFilterKey) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (key: ItemsSortKey) => void;
  onGroupByWorksetChange: (value: boolean) => void;
  onBack: () => void;
  onAddItem: () => void;
  onManageCategories: () => void;
};

/** Entry-list top strip — back · title · filters · search · layout · sort · actions. */
export function ItemsEntryToolbar({
  listTitle,
  filter,
  search,
  sort,
  groupByWorkset,
  onFilterChange,
  onSearchChange,
  onSortChange,
  onGroupByWorksetChange,
  onBack,
  onAddItem,
  onManageCategories,
}: Props) {
  const { t } = useTranslation("items");

  return (
    <ItemsPageChrome
      title={listTitle}
      back={{ onClick: onBack, ariaLabel: t("backToCategories") }}
      controlsAriaLabel={t("filterBarAria")}
      controls={
        <>
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
          <ItemsChromeSearch
            value={search}
            onChange={onSearchChange}
            ariaKey="searchAria"
            data-testid="items-entry-search"
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
          <SelectField
            className={itemsPageChromeSelectClass}
            value={sort}
            onChange={(e) => onSortChange(e.target.value as ItemsSortKey)}
            aria-label={t("sortAria")}
            data-testid="items-entry-sort"
          >
            <option value="expiry">{t("sortExpiry")}</option>
            <option value="name">{t("sortName")}</option>
            <option value="updated">{t("sortUpdated")}</option>
          </SelectField>
        </>
      }
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onManageCategories}>
            <Tags size={14} strokeWidth={2} aria-hidden />
            {t("manageCategories")}
          </Button>
          <Button variant="primary" size="sm" onClick={onAddItem}>
            {t("addItem")}
          </Button>
        </>
      }
      data-testid="items-entry-toolbar"
    />
  );
}
