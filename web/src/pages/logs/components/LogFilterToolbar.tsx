import { useMemo } from "react";
import { FilterX, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, MenuSelect, OpsControlBar, TextField } from "../../../components/ui";
import { pageOpsControlClass, pageOpsIconButtonClass } from "../../../components/ui/controlStyles";
import { useLogPageContext } from "../LogPageContext";

const compactFieldClass = `${pageOpsControlClass} !w-auto !px-2`;
const compactIconButtonClass = pageOpsIconButtonClass;

/** Compact single-row log chrome — denser controls, no horizontal scroll. */
export function LogFilterToolbar() {
  const { t } = useTranslation("logs");
  const {
    search,
    setSearch,
    normalizedLevelFilter,
    setLevelFilter,
    normalizedCategoryFilter,
    setCategoryFilter,
    showAnalysisTrace,
    setShowAnalysisTrace,
    hasActiveFilters,
    resetFilters,
    manuallyRefreshing,
    handleRefreshLogs,
    clearLogs,
  } = useLogPageContext();

  const levelOptions = useMemo(
    () => [
      { value: "all", label: t("level.all") },
      { value: "info", label: t("level.info") },
      { value: "success", label: t("level.success") },
      { value: "warning", label: t("level.warning") },
      { value: "error", label: t("level.error") },
    ],
    [t],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "all", label: t("category.all") },
      { value: "analysis", label: t("category.analysis") },
      { value: "collector", label: t("category.collector") },
      { value: "source", label: t("category.source") },
      { value: "system", label: t("category.system") },
      { value: "frontend", label: t("category.frontend") },
    ],
    [t],
  );

  return (
    <OpsControlBar
      sticky
      ariaLabel={t("toolbar.aria")}
      data-testid="log-filter-toolbar"
      className="!gap-1 !py-1"
    >
      <TextField
        type="search"
        className={`${compactFieldClass} min-w-0 max-w-[14rem] flex-1 basis-[8rem]`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("toolbar.searchPlaceholder")}
        aria-label={t("toolbar.searchAria")}
        data-im-search
      />
      <MenuSelect
        variant="toolbar"
        menuPortal
        triggerClassName={`${compactFieldClass} shrink-0`}
        value={normalizedLevelFilter}
        options={levelOptions}
        onChange={setLevelFilter}
        aria-label={t("toolbar.levelAria")}
        data-testid="log-level-filter"
      />
      <MenuSelect
        variant="toolbar"
        menuPortal
        triggerClassName={`${compactFieldClass} shrink-0`}
        value={normalizedCategoryFilter}
        options={categoryOptions}
        onChange={setCategoryFilter}
        aria-label={t("toolbar.categoryAria")}
        data-testid="log-category-filter"
      />
      <label
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-caption text-text-secondary"
        title={t("toolbar.showAnalysisTraceTitle")}
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 cursor-pointer accent-[var(--accent)]"
          checked={showAnalysisTrace}
          onChange={(e) => setShowAnalysisTrace(e.target.checked)}
          data-testid="log-show-analysis-trace"
          aria-label={t("toolbar.showAnalysisTrace")}
        />
        <span className="whitespace-nowrap">{t("toolbar.showAnalysisTrace")}</span>
      </label>
      {hasActiveFilters ? (
        <Button
          variant="ghost"
          size="sm"
          className={compactIconButtonClass}
          onClick={resetFilters}
          aria-label={t("toolbar.resetAria")}
          title={t("toolbar.resetTitle")}
        >
          <FilterX size={14} strokeWidth={2.2} aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className={compactIconButtonClass}
        disabled={manuallyRefreshing}
        onClick={() => void handleRefreshLogs().catch(() => {})}
        aria-label={manuallyRefreshing ? t("toolbar.refreshingAria") : t("toolbar.refreshAria")}
        title={t("toolbar.refreshTitle")}
      >
        <RefreshCw
          size={14}
          strokeWidth={2.2}
          aria-hidden="true"
          className={manuallyRefreshing ? "im-spin" : undefined}
        />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={compactIconButtonClass}
        onClick={clearLogs}
        aria-label={t("toolbar.clearAria")}
        title={t("toolbar.clearTitle")}
      >
        <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
      </Button>
    </OpsControlBar>
  );
}
