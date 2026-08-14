/**
 * Viewer Results Page — displays stats summary using GET /api/v1/viewer/stats.
 */

import { useTranslation } from "react-i18next";
import { fetchViewerStats } from "../../api/viewer";
import type { ViewerStats } from "../../types";
import { StatCard } from "../../components/ui";
import { useViewerResource } from "./useViewerResource";
import { ViewerShell } from "../../components/ui/ViewerShell";

export function ViewerResultsPage() {
  const { t } = useTranslation("common");
  const { data: stats, initialLoading, isRefreshing, error, retry } = useViewerResource<ViewerStats>(
    fetchViewerStats,
    t("viewer:resultsLoadError"),
  );

  if (!initialLoading && !error && !stats) {
    return (
      <ViewerShell
        initialLoading={false}
        isRefreshing={isRefreshing}
        error={null}
        retry={retry}
        refreshLabel={t("viewer:resultsRefreshing")}
      >
        <p className="text-body text-text-secondary">{t("viewer:noData")}</p>
      </ViewerShell>
    );
  }

  const statCards = stats
    ? [
        { label: t("viewer:totalTasks"), value: stats.totalTasks },
        { label: t("viewer:activeTasks"), value: stats.activeTasks },
        { label: t("viewer:totalBatches"), value: stats.totalBatches },
        { label: t("viewer:completedBatches"), value: stats.completedBatches },
        { label: t("viewer:totalResults"), value: stats.totalResults },
      ]
    : [];

  return (
    <ViewerShell
      initialLoading={initialLoading}
      isRefreshing={isRefreshing}
      error={error}
      retry={retry}
      refreshLabel={t("viewer:resultsRefreshing")}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-lg">
        {statCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={String(card.value)} />
        ))}
      </div>
    </ViewerShell>
  );
}
