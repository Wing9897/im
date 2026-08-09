import { useTranslation } from "react-i18next";
import type { AppLogEntry } from "../../../context/appRuntimeShared";
import { DataList, LoadMoreFooter } from "../../../components/ui";
import { LogCard } from "./LogCard";

export function LogList({
  filteredLogs,
  selectedLogId,
  focusedLogId = null,
  totalLogCount,
  hasMoreLogs,
  logsLoadingMore,
  loadedLogsSummary,
  setSelectedLogId,
  setLoadMoreNode,
  setScrollContainerNode,
  onLoadMoreLogs,
}: {
  filteredLogs: AppLogEntry[];
  selectedLogId: string | null;
  focusedLogId?: string | null;
  totalLogCount: number;
  hasMoreLogs: boolean;
  logsLoadingMore: boolean;
  loadedLogsSummary: string;
  setSelectedLogId: (id: string | null) => void;
  setLoadMoreNode: (node: HTMLDivElement | null) => void;
  setScrollContainerNode: (node: HTMLDivElement | null) => void;
  onLoadMoreLogs: () => Promise<void>;
}) {
  const { t } = useTranslation("logs");
  const hint = logsLoadingMore
    ? t("list.loadingMore")
    : hasMoreLogs
      ? t("list.loadedMore", { summary: loadedLogsSummary })
      : t("list.allLoaded", { total: totalLogCount });

  return (
    <DataList ref={setScrollContainerNode}>
      {filteredLogs.map((entry) => (
        <LogCard
          key={entry.id}
          entry={entry}
          isSelected={focusedLogId === entry.id || selectedLogId === entry.id}
          onSelect={() => setSelectedLogId(entry.id)}
        />
      ))}
      <LoadMoreFooter
        ref={setLoadMoreNode}
        hint={hint}
        hasMore={hasMoreLogs}
        loadingMore={logsLoadingMore}
        onLoadMore={() => void onLoadMoreLogs().catch(() => {})}
        loadMoreLabel={t("list.loadMoreLabel")}
        loadMoreAriaLabel={t("list.loadMoreAria")}
      />
    </DataList>
  );
}
