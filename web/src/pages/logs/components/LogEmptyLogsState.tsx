import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../../components/common/EmptyState";
import { EmptyStateGlyph } from "../../../components/common/EmptyStateGlyph";
import type { AppLogEntry } from "../../../context/appRuntimeShared";
import { Button } from "../../../components/ui";

export function EmptyLogsState({
  logs,
  hasActiveFilters,
  hasMoreLogs,
  logsLoadingMore,
  loadedLogsSummary,
  manuallyRefreshing,
  onRefreshLogs,
  onLoadMoreLogs,
  resetFilters,
}: {
  logs: AppLogEntry[];
  hasActiveFilters: boolean;
  hasMoreLogs: boolean;
  logsLoadingMore: boolean;
  loadedLogsSummary: string;
  manuallyRefreshing: boolean;
  onRefreshLogs: () => Promise<void>;
  onLoadMoreLogs: () => Promise<void>;
  resetFilters: () => void;
}) {
  const { t } = useTranslation("logs");

  const title = logs.length === 0 ? t("empty.noneTitle") : t("empty.filteredTitle");
  let description: string;
  if (logs.length === 0) {
    description = t("empty.noneDescription");
  } else if (hasActiveFilters) {
    description = hasMoreLogs
      ? t("empty.filteredDescriptionMore", { summary: loadedLogsSummary })
      : t("empty.filteredDescriptionAll", { count: logs.length });
  } else {
    description = t("empty.filteredDescriptionNone");
  }

  let hint: string | undefined;
  if (logs.length === 0) {
    hint = t("empty.noneHint");
  } else if (hasActiveFilters) {
    hint = hasMoreLogs ? t("empty.filteredHintMore") : t("empty.filteredHintAll");
  }

  return (
    <EmptyState
      title={title}
      description={description}
      hint={hint}
      illustration={<EmptyStateGlyph icon={ScrollText} />}
      actions={
        hasActiveFilters ? (
          <div className="flex flex-wrap gap-2.5">
            {hasMoreLogs && (
              <Button
                variant="secondary"
                onClick={() => void onLoadMoreLogs().catch(() => {})}
                disabled={logsLoadingMore}
              >
                {logsLoadingMore ? t("empty.loadMoreLoading") : t("empty.loadMoreLabel")}
              </Button>
            )}
            <Button variant="secondary" onClick={resetFilters}>
              {t("empty.resetFilters")}
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <Button
            variant="secondary"
            onClick={() => void onRefreshLogs().catch(() => {})}
            disabled={manuallyRefreshing}
          >
            {manuallyRefreshing ? t("empty.refreshing") : t("empty.refresh")}
          </Button>
        ) : undefined
      }
    />
  );
}
