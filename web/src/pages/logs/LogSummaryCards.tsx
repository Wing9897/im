import { useTranslation } from "react-i18next";
import { StatsStrip } from "../../components/ui";
import { useLogPageContext } from "./LogPageContext";

export function LogSummaryCards() {
  const { t } = useTranslation("logs");
  const {
    activeAnalyses,
    totalLogCount,
    analysisCount,
    errorCount,
  } = useLogPageContext();
  const concurrentCount = activeAnalyses?.size ?? 0;
  const leadAnalysis =
    concurrentCount > 0 ? activeAnalyses!.values().next().value ?? null : null;

  return (
    <StatsStrip
      className="mb-lg"
      items={[
        {
          label: t("summary.status"),
          value: (
            <span
              className={`block truncate text-section-title ${
                leadAnalysis ? "text-info" : "text-text-secondary"
              }`}
            >
              {leadAnalysis
                ? concurrentCount > 1
                  ? t("summary.analyzingConcurrent", {
                      task: leadAnalysis.taskName || t("summary.unnamedTask"),
                      count: concurrentCount,
                    })
                  : t("summary.analyzing", {
                      task: leadAnalysis.taskName || t("summary.unnamedTask"),
                    })
                : t("summary.idle")}
            </span>
          ),
        },
        {
          label: t("summary.totalEvents"),
          value: totalLogCount,
        },
        {
          label: t("summary.analysisEvents"),
          value: <span className="text-info">{analysisCount}</span>,
        },
        {
          label: t("summary.errorEvents"),
          value: (
            <span className={errorCount > 0 ? "text-error" : "text-success"}>
              {errorCount}
            </span>
          ),
        },
      ]}
    />
  );
}
