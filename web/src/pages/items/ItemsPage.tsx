import { Tags, Wallet } from "lucide-react";
import { AlertBanner, Button, MenuSelect } from "../../components/ui";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { contentFadeClass } from "../../components/ui/pageLayout";
import { CategoryManageDialog } from "./CategoryManageDialog";
import { ItemsCategoryLayer } from "./ItemsCategoryLayer";
import { ItemsChromeSearch } from "./ItemsChromeSearch";
import { ItemsEntryList } from "./ItemsEntryList";
import { ItemsEntryToolbar } from "./ItemsEntryToolbar";
import { ItemsPageChrome } from "./ItemsPageChrome";
import {
  itemsPageChromeCategorySearchWrapClass,
  itemsPageChromeEntryToolsClass,
  itemsPageChromeSelectClass,
  itemsPageFillClass,
} from "../../styles/itemsPageChromeClasses";
import type { ItemsSortKey } from "../../domain/items/itemsListModel";
import { useItemsPage } from "./useItemsPage";

export function ItemsPage() {
  const {
    t,
    listLayer,
    categoryRouteId,
    loading,
    error,
    categories,
    categoriesEmpty,
    filter,
    setFilter,
    search,
    setSearch,
    categorySearch,
    setCategorySearch,
    categorySort,
    setCategorySort,
    sort,
    setSort,
    groupByWorkset,
    setGroupByWorkset,
    manageCategories,
    setManageCategories,
    worksetFilterId,
    worksets,
    categoryById,
    worksetById,
    categorySortOptions,
    allTypesSummary,
    filteredCategorySummaries,
    sortedCategorySummaries,
    categorySearchActive,
    categorySearchEmpty,
    emptyKind,
    searchActive,
    listTitle,
    sortedItems,
    grouped,
    clearFilters,
    setWorksetFilterId,
    openCategory,
    openCreate,
    openEdit,
    duplicateItem,
    onCategoryEmojiChange,
    refresh,
    navigate,
  } = useItemsPage();

  const paneClass = `im-animate-in min-w-0 ${contentFadeClass}`;

  const primaryActions = (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => navigate("/items/finance")}
        aria-label={t("finance.openAria")}
        title={t("finance.open")}
        data-testid="items-category-finance"
      >
        <Wallet size={14} strokeWidth={2} aria-hidden />
        {t("finance.open")}
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setManageCategories(true)}>
        <Tags size={14} strokeWidth={2} aria-hidden />
        {t("manageCategories")}
      </Button>
      <Button variant="primary" size="sm" onClick={openCreate} data-testid="items-category-add">
        {t("addItem")}
      </Button>
    </>
  );

  return (
    <div className={itemsPageFillClass} data-testid="items-page">
      {listLayer ? (
        <ItemsEntryToolbar
          listTitle={listTitle}
          filter={filter}
          search={search}
          sort={sort}
          groupByWorkset={groupByWorkset}
          worksetFilterId={worksetFilterId}
          worksets={worksets}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
          onSortChange={setSort}
          onGroupByWorksetChange={setGroupByWorkset}
          onWorksetFilterChange={setWorksetFilterId}
          onBack={() => navigate("/items")}
          onAddItem={openCreate}
          onManageCategories={() => setManageCategories(true)}
          onOpenFinance={() => navigate("/items/finance")}
        />
      ) : (
        <ItemsPageChrome
          controlsAriaLabel={t("categorySearchAria")}
          controls={
            <div className={itemsPageChromeEntryToolsClass}>
              <ItemsChromeSearch
                value={categorySearch}
                onChange={setCategorySearch}
                placeholderKey="categorySearchPlaceholder"
                ariaKey="categorySearchAria"
                wrapClassName={itemsPageChromeCategorySearchWrapClass}
                data-testid="items-category-search"
              />
              <MenuSelect
                variant="toolbar"
                menuPortal
                className="min-w-[6rem]"
                triggerClassName={itemsPageChromeSelectClass}
                value={categorySort}
                options={categorySortOptions}
                onChange={(value) => setCategorySort(value as ItemsSortKey)}
                aria-label={t("sortAria")}
                data-testid="items-category-sort"
              />
            </div>
          }
          actions={primaryActions}
          data-testid="items-category-toolbar"
        />
      )}

      <div className="im-auto-scrollbar min-h-0 overflow-y-auto">
        <div className="mx-auto w-full min-w-0 max-w-[1280px] px-page-x py-md max-[780px]:px-sm max-[780px]:py-sm">
          {error ? (
            <AlertBanner variant="error" role="alert">
              {error}
            </AlertBanner>
          ) : null}
          {loading ? (
            <div className="min-h-[12rem]" aria-busy="true">
              <SkeletonScreen variant="card-grid" count={6} columns={3} />
            </div>
          ) : null}

          {!listLayer && !loading ? (
            <div
              className={paneClass}
              data-allow-opacity-transition
              data-testid="items-category-pane"
            >
              <ItemsCategoryLayer
                categoriesEmpty={categoriesEmpty}
                searchEmpty={categorySearchEmpty}
                showAllTypes={!categorySearchActive}
                allTypesSummary={allTypesSummary}
                categorySummaries={
                  categorySearchActive ? filteredCategorySummaries : sortedCategorySummaries
                }
                onOpenCategory={openCategory}
                onManageCategories={() => setManageCategories(true)}
                onAddItem={openCreate}
                onClearSearch={() => setCategorySearch("")}
                onCategoryEmojiChange={onCategoryEmojiChange}
              />
            </div>
          ) : null}

          {listLayer && !loading ? (
            <div
              className={paneClass}
              data-allow-opacity-transition
              data-testid="items-entry-pane"
              key={categoryRouteId ?? "list"}
            >
              <ItemsEntryList
                emptyKind={emptyKind}
                searchActive={searchActive}
                groupByWorkset={groupByWorkset}
                items={sortedItems}
                grouped={grouped}
                categoryById={categoryById}
                worksetById={worksetById}
                onClearFilters={clearFilters}
                onAddItem={openCreate}
                onOpenItem={openEdit}
                onDuplicateItem={duplicateItem}
                onRefresh={refresh}
              />
            </div>
          ) : null}
        </div>
      </div>

      {manageCategories ? (
        <CategoryManageDialog
          categories={categories}
          onClose={() => setManageCategories(false)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}
