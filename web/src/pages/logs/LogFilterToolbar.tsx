import { FilterX, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, OpsControlBar, SelectField, TextField } from "../../components/ui";
import { pageOpsControlClass, pageOpsIconButtonClass } from "../../components/ui/controlStyles";
import { useLogPageContext } from "./LogPageContext";

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
    hasActiveFilters,
    resetFilters,
    manuallyRefreshing,
    handleRefreshLogs,
    clearLogs,
  } = useLogPageContext();

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
      <SelectField
        className={`${compactFieldClass} shrink-0`}
        value={normalizedLevelFilter}
        onChange={(e) => setLevelFilter(e.target.value)}
        aria-label={t("toolbar.levelAria")}
      >
        <option value="all">{t("level.all")}</option>
        <option value="info">{t("level.info")}</option>
        <option value="success">{t("level.success")}</option>
        <option value="warning">{t("level.warning")}</option>
        <option value="error">{t("level.error")}</option>
      </SelectField>
      <SelectField
        className={`${compactFieldClass} shrink-0`}
        value={normalizedCategoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
        aria-label={t("toolbar.categoryAria")}
      >
        <option value="all">{t("category.all")}</option>
        <option value="analysis">{t("category.analysis")}</option>
        <option value="collector">{t("category.collector")}</option>
        <option value="account">{t("category.account")}</option>
        <option value="system">{t("category.system")}</option>
        <option value="frontend">{t("category.frontend")}</option>
      </SelectField>
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
