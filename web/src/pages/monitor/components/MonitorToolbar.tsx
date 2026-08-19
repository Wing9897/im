import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshIndicator } from "../../../components/common/RefreshIndicator";
import { OpsControlBar, TextField } from "../../../components/ui";
import { pageOpsControlClass } from "../../../components/ui/controlStyles";
import { MonitorViewToggle } from "./MonitorViewToggle";
import type { MonitorViewMode } from "../../../domain/monitor/monitorViewMode";

const SEARCH_DEBOUNCE_MS = 400;

interface MonitorToolbarProps {
  viewMode: MonitorViewMode;
  onViewModeChange: (mode: MonitorViewMode) => void;
  statusLabel: ReactNode;
  isRefreshing?: boolean;
  /** Compact triggers only (filter / channel picker) — keep chips in `secondary`. */
  controls?: ReactNode;
  /** Active filter chips row under the main chrome (stream mode). */
  secondary?: ReactNode;
  search?: string;
  onSearchChange?: (search: string) => void;
}

/**
 * Monitor chrome aligned with message-wall density:
 * status | search + trigger | view toggle, optional chips on a second row.
 */
export function MonitorToolbar({
  viewMode,
  onViewModeChange,
  statusLabel,
  isRefreshing = false,
  controls,
  secondary,
  search,
  onSearchChange,
}: MonitorToolbarProps) {
  const { t } = useTranslation("monitor");
  const [searchDraft, setSearchDraft] = useState(search ?? "");

  useEffect(() => {
    setSearchDraft(search ?? "");
  }, [search]);

  useEffect(() => {
    if (!onSearchChange) return;
    if (searchDraft === (search ?? "")) return;
    const timer = window.setTimeout(() => {
      onSearchChange(searchDraft);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [onSearchChange, search, searchDraft]);

  return (
    <OpsControlBar
      sticky
      ariaLabel={t("toolbar.aria")}
      data-testid="monitor-toolbar"
      className="!min-h-0 flex-col !items-stretch !flex-nowrap"
    >
      <div className="flex min-h-8 items-center gap-sm">
        <span
          className={
            viewMode === "list"
              ? "im-monitor-stream-status min-w-0 shrink truncate text-[11px] leading-none text-text-secondary"
              : "min-w-0 shrink truncate text-[11px] leading-none text-text-muted"
          }
        >
          {statusLabel}
        </span>
        {isRefreshing ? <RefreshIndicator label={t("toolbar.refreshing")} /> : null}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {onSearchChange ? (
            <TextField
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t("toolbar.searchPlaceholder")}
              aria-label={t("toolbar.searchAria")}
              data-im-search
              className={`${pageOpsControlClass} w-[clamp(10rem,22vw,16rem)]`}
            />
          ) : null}
          {controls}
          <MonitorViewToggle mode={viewMode} onChange={onViewModeChange} />
        </div>
      </div>
      {secondary ? (
        <div
          className="flex min-w-0 flex-wrap items-center gap-1.5"
          data-testid="monitor-toolbar-secondary"
        >
          {secondary}
        </div>
      ) : null}
    </OpsControlBar>
  );
}
