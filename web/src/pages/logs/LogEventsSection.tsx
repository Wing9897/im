import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/common/EmptyState";
import { Button } from "../../components/ui";
import { MasterDetailSplit } from "../../components/detail";
import { useListKeyboardNavigation } from "../../hooks/useListKeyboardNavigation";
import { useDetailPresentation } from "../../hooks/useDetailPresentation";
import { EmptyLogsState } from "./LogEmptyLogsState";
import { LogDetailView } from "./LogDetailDialog";
import { useLogPageContext } from "./LogPageContext";
import { LogList } from "./LogList";

export function LogEventsSection() {
  const { t } = useTranslation("logs");
  const {
    logs,
    filteredLogs,
    totalLogCount,
    hasMoreLogs,
    logsLoadingMore,
    logLoadError,
    loadedLogsSummary,
    hasActiveFilters,
    showLoadingState,
    showLoadRecoveryState,
    manuallyRefreshing,
    selectedLogId,
    selectedLog,
    setSelectedLogId,
    setLoadMoreNode,
    setScrollContainerNode,
    handleLoadMoreLogs,
    handleRefreshLogs,
    resetFilters,
  } = useLogPageContext();

  const presentation = useDetailPresentation();
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const selectLogById = useCallback(
    (id: string) => setSelectedLogId(id),
    [setSelectedLogId],
  );

  useListKeyboardNavigation({
    items: filteredLogs,
    selectedId: focusedId ?? selectedLogId,
    getItemId: (entry) => entry.id,
    onSelect: (entry) => setFocusedId(entry.id),
    onActivate: (entry) => selectLogById(entry.id),
    onEscape: () => setSelectedLogId(null),
    enabled: filteredLogs.length > 0 && !showLoadingState && !showLoadRecoveryState,
  });

  const listContent = showLoadingState ? (
    <EmptyState
      title={t("section.loadingTitle")}
      description={t("section.loadingDescription")}
      hint={t("section.loadingHint")}
      actions={
        <Button
          variant="secondary"
          onClick={() => void handleRefreshLogs().catch(() => {})}
          disabled={manuallyRefreshing}
        >
          {manuallyRefreshing ? t("section.refreshing") : t("section.refresh")}
        </Button>
      }
      compact
    />
  ) : showLoadRecoveryState ? (
    <EmptyState
      title={t("section.recoveryTitle")}
      description={
        logLoadError
          ? t("section.recoveryDescriptionWithError", { error: logLoadError })
          : t("section.recoveryDescriptionDefault")
      }
      hint={t("section.recoveryHint")}
      actions={
        <Button
          variant="secondary"
          onClick={() => void handleRefreshLogs().catch(() => {})}
          disabled={manuallyRefreshing}
        >
          {manuallyRefreshing ? t("section.refreshing") : t("section.refresh")}
        </Button>
      }
      compact
    />
  ) : filteredLogs.length === 0 ? (
    <EmptyLogsState
      logs={logs}
      hasActiveFilters={hasActiveFilters}
      hasMoreLogs={hasMoreLogs}
      logsLoadingMore={logsLoadingMore}
      loadedLogsSummary={loadedLogsSummary}
      manuallyRefreshing={manuallyRefreshing}
      onRefreshLogs={handleRefreshLogs}
      onLoadMoreLogs={handleLoadMoreLogs}
      resetFilters={resetFilters}
    />
  ) : (
    <LogList
      filteredLogs={filteredLogs}
      selectedLogId={selectedLogId}
      focusedLogId={focusedId}
      totalLogCount={totalLogCount}
      hasMoreLogs={hasMoreLogs}
      logsLoadingMore={logsLoadingMore}
      loadedLogsSummary={loadedLogsSummary}
      setSelectedLogId={(id) => {
        if (id) setFocusedId(id);
        setSelectedLogId(id);
      }}
      setLoadMoreNode={setLoadMoreNode}
      setScrollContainerNode={setScrollContainerNode}
      onLoadMoreLogs={handleLoadMoreLogs}
    />
  );

  const detailView = selectedLog ? (
    <LogDetailView
      selectedLog={selectedLog}
      onClose={() => setSelectedLogId(null)}
      presentation={presentation}
    />
  ) : null;

  const listColumn = (
    <>
      <div className="mb-sm text-xs text-text-muted">
        {hasMoreLogs
          ? t("list.summaryMore", {
              shown: filteredLogs.length,
              summary: loadedLogsSummary,
            })
          : t("list.summaryAll", {
              shown: filteredLogs.length,
              total: totalLogCount,
            })}
      </div>
      {listContent}
    </>
  );

  return (
    <>
      <MasterDetailSplit
        split={presentation === "inline" && selectedLog != null}
        list={listColumn}
        detail={presentation === "inline" ? detailView : null}
      />
      {presentation === "drawer" ? detailView : null}
    </>
  );
}
