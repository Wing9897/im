/**
 * Viewer Status Page — displays system status using GET /api/v1/viewer/status.
 */

import { useTranslation } from "react-i18next";
import { fetchViewerStatus } from "../../api/viewer";
import type { ViewerStatus } from "../../types";
import { SurfaceCard } from "../../components/ui";
import { useViewerResource } from "./useViewerResource";
import { ViewerShell } from "../../components/ui/ViewerShell";

function formatUptime(
  seconds: number,
  t: (key: string, opts?: Record<string, number>) => string,
): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return t("viewer:uptimeHours", { hours, minutes });
  }
  return t("viewer:uptimeMinutes", { minutes });
}

export function ViewerStatusPage() {
  const { t } = useTranslation("common");
  const { data: status, initialLoading, isRefreshing, error, retry } = useViewerResource<ViewerStatus>(
    fetchViewerStatus,
    t("viewer:statusLoadError"),
  );

  if (!initialLoading && !error && !status) {
    return (
      <ViewerShell
        initialLoading={false}
        isRefreshing={isRefreshing}
        error={null}
        retry={retry}
        refreshLabel={t("viewer:statusRefreshing")}
      >
        <p className="text-body text-text-secondary">{t("viewer:noData")}</p>
      </ViewerShell>
    );
  }

  const statusItems = status
    ? [
        {
          label: t("viewer:queueDepth"),
          value: String(status.queueDepth),
          description: t("viewer:queueDepthDesc"),
        },
        {
          label: t("viewer:collectorStatus"),
          value: status.collectorAlive
            ? t("viewer:collectorRunning")
            : t("viewer:collectorStopped"),
          description: t("viewer:collectorDesc"),
          isGood: status.collectorAlive,
        },
        {
          label: t("viewer:analysisStatus"),
          value: status.analysisPaused
            ? t("viewer:analysisPaused")
            : t("viewer:analysisRunning"),
          description: t("viewer:analysisDesc"),
          isGood: !status.analysisPaused,
        },
        {
          label: t("viewer:uptime"),
          value: formatUptime(status.uptimeSeconds, t),
          description: t("viewer:uptimeDesc"),
        },
      ]
    : [];

  return (
    <ViewerShell
      initialLoading={initialLoading}
      isRefreshing={isRefreshing}
      error={error}
      retry={retry}
      refreshLabel={t("viewer:statusRefreshing")}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-lg">
        {statusItems.map((item) => (
          <SurfaceCard key={item.label} density="field" className="flex flex-col gap-xs">
            <div className="flex items-center justify-between gap-sm">
              <span className="text-caption font-semibold text-text-muted">{item.label}</span>
              {item.isGood !== undefined && (
                <span
                  className={`h-2 w-2 rounded-full ${item.isGood ? "bg-success" : "bg-error"}`}
                  aria-label={item.isGood ? t("viewer:statusOk") : t("viewer:statusBad")}
                />
              )}
            </div>
            <span className="text-section-title font-semibold text-text-primary">{item.value}</span>
            <span className="text-card-meta text-text-subtle">{item.description}</span>
          </SurfaceCard>
        ))}
      </div>
    </ViewerShell>
  );
}
