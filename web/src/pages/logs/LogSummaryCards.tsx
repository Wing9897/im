import { useTranslation } from "react-i18next";
import { StatsStrip } from "../../components/ui";
import { useLogPageContext } from "./LogPageContext";

export function LogSummaryCards() {
  const { t } = useTranslation("logs");
  const {
    activeAnalysis,
    totalLogCount,
    analysisCount,
    errorCount,
  } = useLogPageContext();

  return (
    <StatsStrip
      className="mb-lg"
      items={[
        {
          label: t("summary.status"),
          value: (
            <span
              className={`block truncate text-section-title ${
                activeAnalysis ? "text-info" : "text-text-secondary"
              }`}
            >
              {activeAnalysis
                ? t("summary.analyzing", {
                    task: activeAnalysis.taskName || t("summary.unnamedTask"),
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
