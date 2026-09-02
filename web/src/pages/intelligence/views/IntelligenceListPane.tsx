import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../../components/common/EmptyState";
import { EmptyStateIntelligence } from "../../../assets/illustrations/EmptyStateIllustrations";
import { SkeletonScreen } from "../../../components/common/SkeletonScreen";
import {
  Button,
  CardGrid,
  DataList,
  EmptyStateLink,
  LoadMoreFooter,
} from "../../../components/ui";
import { contentFadeClass } from "../../../components/ui/pageLayout";
import { useListKeyboardNavigation } from "../../../hooks/useListKeyboardNavigation";
import type { AnalysisEvent, ViewMode } from "../../../types";
import type { PipelineReadinessState } from "../../../domain/pipeline/pipelineReadiness";
import { IntelligenceCard } from "./IntelligenceCardView";
import { IntelligenceDetailView } from "./IntelligenceDetailDialog";
import { IntelligenceRow } from "./IntelligenceListView";
import { getIntelligenceEmptyCopy } from "../intelligenceEmptyState";
import { PipelineGuideChecklist } from "../../../components/pipeline/PipelineGuideChecklist";

/**
 * List + card pane only (infinite scroll + modal detail). Map stays in
 * `map/MapView` — do not fold map markers/timeline into this component.
 */
interface IntelligenceListPaneProps {
  loading: boolean;
  items: AnalysisEvent[];
  viewMode: ViewMode;
  hasMore: boolean;
  loadMoreHint: string;
  loadingMore: boolean;
  readIntelligenceIdSet: Set<string>;
  isConsumed: (itemId: string) => boolean;
  onAutoRead: (id: string) => void;
  selectedItem: AnalysisEvent | null;
  setSelectedItem: (item: AnalysisEvent | null) => void;
  loadMoreItems: () => Promise<void>;
  setLoadMoreTriggerRef: (node: HTMLDivElement | null) => void;
  intelligenceTasksCount: number;
  hasActiveFilters: boolean;
  hasSearchFilter: boolean;
  hasTimeFilter: boolean;
  hasSourceFilter: boolean;
  resetFilters: () => void;
  showPipelineGuide?: boolean;
  pipelineState?: PipelineReadinessState;
  assistantSlotReady?: boolean;
  notIntelBusy?: boolean;
  onNotIntel?: (item: AnalysisEvent) => void;
}

function IntelligenceListPaneComponent({
  loading,
  items,
  viewMode,
  hasMore,
  loadMoreHint,
  loadingMore,
  readIntelligenceIdSet,
  isConsumed,
  onAutoRead,
  selectedItem,
  setSelectedItem,
  loadMoreItems,
  setLoadMoreTriggerRef,
  intelligenceTasksCount,
  hasActiveFilters,
  hasSearchFilter,
  hasTimeFilter,
  hasSourceFilter,
  resetFilters,
  showPipelineGuide = false,
  pipelineState = "no_sources",
  assistantSlotReady = false,
  notIntelBusy,
  onNotIntel,
}: IntelligenceListPaneProps) {
  const { t } = useTranslation("intelligence");
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useListKeyboardNavigation({
    items: items,
    selectedId: focusedId ?? selectedItem?.id ?? null,
    getItemId: (item) => item.id,
    onSelect: (item) => setFocusedId(item.id),
    onActivate: setSelectedItem,
    onEscape: () => setSelectedItem(null),
    enabled: !loading && viewMode === "list" && items.length > 0,
  });

  if (loading) {
    return (
      <SkeletonScreen
        variant={viewMode === "card" ? "card-grid" : "list-rows"}
        count={viewMode === "card" ? 6 : 8}
      />
    );
  }

  if (items.length === 0) {
    if (showPipelineGuide && !hasActiveFilters) {
      return (
        <PipelineGuideChecklist
          state={pipelineState}
          assistantSlotReady={assistantSlotReady}
        />
      );
    }
    const copy = getIntelligenceEmptyCopy(
      {
        intelligenceTasksCount,
        hasActiveFilters,
        hasSearchFilter,
        hasTimeFilter,
        hasSourceFilter,
      },
      t,
    );

    return (
      <EmptyState
        illustration={<EmptyStateIntelligence />}
        title={copy.title}
        description={copy.description}
        hint={copy.hint}
        actions={
          copy.showGoToTasks ? (
            <EmptyStateLink to="/worksets?tab=tasks">{t("cta.goToTasks")}</EmptyStateLink>
          ) : copy.showClearFilters ? (
            <Button
              variant="secondary"
              onClick={resetFilters}
              aria-label={t("cta.clearFiltersAria")}
            >
              {t("cta.clearFilters")}
            </Button>
          ) : undefined
        }
      />
    );
  }

  const loadMoreFooter = (
    <LoadMoreFooter
      ref={setLoadMoreTriggerRef}
      hint={loadMoreHint}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => void loadMoreItems()}
      loadMoreAriaLabel={t("loadMore.aria")}
      asDataListFooter={viewMode === "list"}
    />
  );

  return (
    <>
      {viewMode === "card" ? (
        <div
          className={`im-animate-in min-w-0 ${contentFadeClass}`}
          data-allow-opacity-transition
        >
          <CardGrid className="im-intelligence-editorial-grid">
            {items.map((item) => (
              <IntelligenceCard
                key={item.id}
                item={item}
                isRead={readIntelligenceIdSet.has(item.id)}
                isConsumed={isConsumed(item.id)}
                onAutoRead={onAutoRead}
                onClick={setSelectedItem}
                notIntelBusy={notIntelBusy}
                onNotIntel={onNotIntel}
              />
            ))}
          </CardGrid>
          {loadMoreFooter}
        </div>
      ) : (
        <DataList
          variant="flush"
          className={`im-animate-in ${contentFadeClass}`}
          data-allow-opacity-transition
        >
          {items.map((item) => (
            <IntelligenceRow
              key={item.id}
              item={item}
              isRead={readIntelligenceIdSet.has(item.id)}
              isConsumed={isConsumed(item.id)}
              isSelected={focusedId === item.id || selectedItem?.id === item.id}
              onAutoRead={onAutoRead}
              notIntelBusy={notIntelBusy}
              onNotIntel={onNotIntel}
              onClick={(next) => {
                setFocusedId(next.id);
                setSelectedItem(next);
              }}
            />
          ))}
          {loadMoreFooter}
        </DataList>
      )}

      {selectedItem ? (
        <IntelligenceDetailView
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          presentation="modal"
          notIntelBusy={notIntelBusy}
          onNotIntel={onNotIntel}
        />
      ) : null}
    </>
  );
}

export const IntelligenceListPane = React.memo(IntelligenceListPaneComponent);
