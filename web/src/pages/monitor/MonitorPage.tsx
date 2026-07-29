import { useCallback, useState } from "react";
import { Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/common/EmptyState";
import { FilterActiveChips, FilterBar } from "./filter/FilterBar";
import { countActiveMessageFilters } from "./monitorPageModel";
import { SectionErrorBoundary } from "../../components/common/SectionErrorBoundary";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { MessageListItem } from "./message/MessageListItem";
import {
  AppPageShell,
  Button,
  DataList,
  EmptyStateLink,
  LoadMoreFooter,
} from "../../components/ui";
import { contentFadeClass } from "../../components/ui/pageLayout";
import { useDetailSelection } from "../../components/detail";
import type { Message } from "../../types";
import { MessageDetailView } from "./MessageDetailDialog";
import { MonitorCardFeed } from "./MonitorCardFeed";
import { MonitorToolbar } from "./MonitorToolbar";
import { MonitorWallSection } from "./MonitorWallSection";
import { monitorStreamStatusLabel } from "./monitorStatusLabel";
import { useMonitorPage } from "./useMonitorPage";
import { useMonitorRouteState } from "./useMonitorRouteState";
import { useMonitorSelectionUrl } from "./useMonitorSelectionUrl";
import { useMonitorFiltersUrl } from "./useMonitorFiltersUrl";
import { useListKeyboardNavigation } from "../../hooks/useListKeyboardNavigation";
import { useIdReadTracking } from "../../hooks/useIdReadTracking";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import { useErrorToast } from "../../hooks/useErrorToast";
import { MONITOR_READ_IDS_STORAGE_KEY } from "../../domain/monitor/monitorPersistedKeys";

/**
 * Monitor workspace (stream / cards / wall).
 *
 * INVARIANTS:
 * - Data: `useMonitorData` owns fetch + SSE rebase; do not re-add blanket polling.
 * - Deep-links (`?id=`, filters, view) go through fingerprint URL hooks —
 *   miss-toast only after `listExhausted`; do not re-apply URL every effect tick.
 * - Wall vs stream: wall increments totals; stream merges into the list — do not
 *   share one merge path.
 * Regression fences: `useMonitorData.test.ts`, `useMonitorSelectionUrl.test.ts`.
 */
export function MonitorPage() {
  const { t } = useTranslation("monitor");
  const {
    messages,
    accounts,
    channels,
    channelsReady,
    filters,
    viewMode,
    initialLoading,
    isRefreshing,
    loadingMore,
    hasMore,
    totalCount,
    statsLoading,
    error,
    metadataError,
    listWindow,
    hasActiveFilters,
    setLoadMoreTriggerRef,
    setListContainerRef,
    handleFiltersChange,
    handleLoadMoreAction,
    resetFilters,
    setViewMode,
    retryMetadataLoad,
  } = useMonitorPage();
  useErrorToast(error);

  useMonitorRouteState(setViewMode);
  useMonitorFiltersUrl({
    filters,
    setFilters: handleFiltersChange,
  });

  const { selected: selectedMessage, select: selectMessage, clear: clearMessage } =
    useDetailSelection<Message>();
  const { isConsumed: isMessageRead, markRead: markMessageRead } =
    useIdReadTracking(MONITOR_READ_IDS_STORAGE_KEY);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  useSlashFocusSearch();

  const openMessage = useCallback(
    (message: Message) => {
      markMessageRead(message.id);
      selectMessage(message);
    },
    [markMessageRead, selectMessage],
  );
  const hydrateMessage = useCallback(
    (message: Message) => {
      setFocusedId(message.id);
      openMessage(message);
    },
    [openMessage],
  );

  useMonitorSelectionUrl({
    selectedId: selectedMessage?.id ?? null,
    messages,
    onHydrate: hydrateMessage,
    listBusy: initialLoading || isRefreshing || loadingMore,
    listExhausted: !hasMore,
  });

  const isWallMode = viewMode === "wall";

  useListKeyboardNavigation({
    items: messages,
    selectedId: focusedId ?? selectedMessage?.id ?? null,
    getItemId: (message) => message.id,
    onSelect: (message) => setFocusedId(message.id),
    onActivate: openMessage,
    onEscape: clearMessage,
    enabled:
      !isWallMode &&
      viewMode === "list" &&
      !initialLoading &&
      messages.length > 0,
  });

  const detailView = selectedMessage ? (
    <MessageDetailView
      message={selectedMessage}
      onClose={clearMessage}
      presentation="modal"
    />
  ) : null;

  const loadMoreHint = loadingMore
    ? t("loadMore.loading")
    : hasMore
      ? t("loadMore.scroll")
      : t("loadMore.done");

  const loadMoreFooter =
    !initialLoading && messages.length > 0 ? (
      <LoadMoreFooter
        ref={setLoadMoreTriggerRef}
        hint={loadMoreHint}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={() => void handleLoadMoreAction().catch(() => {})}
        loadMoreAriaLabel={t("loadMore.aria")}
        asDataListFooter={viewMode === "list"}
      />
    ) : null;

  const streamList = (
    <>
      <MonitorToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isRefreshing={isRefreshing}
        statusLabel={monitorStreamStatusLabel({
          initialLoading,
          messagesLength: messages.length,
          totalCount,
          hasMore,
        })}
        controls={
          <FilterBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            accounts={accounts}
            channels={channels}
            onReset={resetFilters}
            showChips={false}
          />
        }
        secondary={
          countActiveMessageFilters(filters) > 0 ? (
            <FilterActiveChips
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          ) : undefined
        }
        search={filters.search ?? ""}
        onSearchChange={(search) => handleFiltersChange({ ...filters, search })}
      />

      {initialLoading ? (
        <SkeletonScreen
          variant={viewMode === "card" ? "card-grid" : "list-rows"}
          count={viewMode === "card" ? 8 : 10}
        />
      ) : messages.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters
              ? t("empty.filteredTitle")
              : accounts.length === 0
                ? t("empty.noAccountsTitle")
                : t("empty.noneTitle")
          }
          description={
            hasActiveFilters
              ? t("empty.filteredDescription")
              : accounts.length === 0
                ? t("empty.noAccountsDescription")
                : t("empty.noneDescription")
          }
          hint={
            hasActiveFilters
              ? t("empty.filteredHint")
              : accounts.length === 0
                ? t("empty.noAccountsHint")
                : t("empty.noneHint")
          }
          illustration={
            accounts.length === 0 ? (
              <Radio size={48} color="var(--accent)" strokeWidth={1.5} aria-hidden="true" />
            ) : undefined
          }
          actions={
            hasActiveFilters ? (
              <Button
                variant="secondary"
                onClick={resetFilters}
                aria-label={t("filter.clearAllAria")}
              >
                {t("cta.clearFilters")}
              </Button>
            ) : accounts.length === 0 ? (
              <>
                <EmptyStateLink to="/accounts">{t("cta.goToAccounts")}</EmptyStateLink>
                <EmptyStateLink to="/tasks">{t("cta.viewTasks")}</EmptyStateLink>
              </>
            ) : (
              <EmptyStateLink to="/accounts">{t("cta.viewAccountStatus")}</EmptyStateLink>
            )
          }
        />
      ) : viewMode === "card" ? (
        <MonitorCardFeed
          messages={messages}
          isMessageRead={isMessageRead}
          onSelectMessage={openMessage}
          setListContainerRef={setListContainerRef}
          footer={loadMoreFooter}
        />
      ) : (
        <DataList
          variant="flush"
          ref={setListContainerRef}
          className={`im-animate-in ${contentFadeClass}`}
          role="table"
          data-allow-opacity-transition
        >
          {listWindow.topSpacerHeight > 0 && (
            <div style={{ height: listWindow.topSpacerHeight }} aria-hidden="true" />
          )}
          {listWindow.visibleMessages.map((msg) => (
            <MessageListItem
              key={msg.id}
              message={msg}
              isRead={isMessageRead(msg.id)}
              isSelected={focusedId === msg.id || selectedMessage?.id === msg.id}
              onSelect={() => {
                setFocusedId(msg.id);
                openMessage(msg);
              }}
            />
          ))}
          {listWindow.bottomSpacerHeight > 0 && (
            <div
              style={{ height: listWindow.bottomSpacerHeight }}
              aria-hidden="true"
            />
          )}
          {loadMoreFooter}
        </DataList>
      )}
    </>
  );

  return (
    <AppPageShell width="fluid">
      <SectionErrorBoundary
        sectionName={isWallMode ? t("sections.wall") : t("sections.list")}
      >
        {isWallMode ? (
          <MonitorWallSection
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            channels={channels}
            channelsReady={channelsReady}
            totalCount={totalCount}
            statsLoading={statsLoading}
            metadataError={metadataError}
            onRetryMetadata={retryMetadataLoad}
          />
        ) : (
          streamList
        )}
      </SectionErrorBoundary>

      {detailView}
    </AppPageShell>
  );
}
