import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { MenuSelect, SegmentedControl } from "../../components/ui";
import { pageOpsControlClass } from "../../components/ui/controlStyles";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import {
  parseWorksetCatalogTab,
  parseWorksetGraphFilter,
  WORKSET_GRAPH_FILTER_PARAM,
  worksetsCatalogPath,
  type WorksetCatalogTab,
} from "../../domain/worksets/worksetRoutes";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

/** MenuSelect value for 全部 — omit `worksetId` in the query. */
const GRAPH_FILTER_ALL = "all";

function isWorksetDetailPath(pathname: string): boolean {
  return /^\/worksets\/.+/u.test(pathname);
}

function worksetFilterLabel(row: { id: string; name: string }, generalName: string): string {
  return row.id === SYSTEM_WORKSET_ID ? generalName : row.name;
}

/** 目錄 | 流程圖 pills for the workset OpsControlBar (catalog and contents). */
export function WorksetCatalogChrome() {
  const { t } = useTranslation("workset");
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { worksets } = useTaskCatalog();
  const onDetail = isWorksetDetailPath(location.pathname);
  const activeTab = onDetail ? "catalog" : parseWorksetCatalogTab(searchParams.get("tab"));
  const filterWorksetId = parseWorksetGraphFilter(searchParams.get(WORKSET_GRAPH_FILTER_PARAM));
  const showGraphFilter = !onDetail && activeTab === "graph";
  const generalName = t("generalName");

  const graphFilterOptions = useMemo(
    () => [
      { value: GRAPH_FILTER_ALL, label: t("graphFilterAll") },
      ...worksets.map((row) => ({
        value: row.id,
        label: worksetFilterLabel(row, generalName),
      })),
    ],
    [generalName, t, worksets],
  );

  const setActiveTab = useCallback(
    (tab: WorksetCatalogTab) => {
      if (onDetail) {
        navigate(worksetsCatalogPath(tab));
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === "catalog") {
            next.delete("tab");
            next.delete(WORKSET_GRAPH_FILTER_PARAM);
          } else {
            next.set("tab", tab);
          }
          return next;
        },
        { replace: true },
      );
    },
    [navigate, onDetail, setSearchParams],
  );

  const setGraphFilter = useCallback(
    (worksetId: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", "graph");
          if (worksetId) next.set(WORKSET_GRAPH_FILTER_PARAM, worksetId);
          else next.delete(WORKSET_GRAPH_FILTER_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <div data-testid="workset-catalog-tabs" className="shrink-0">
        <SegmentedControl
          layout="inline"
          ariaLabel={t("catalogTabsAria")}
          value={activeTab}
          onChange={(id) => setActiveTab(id as WorksetCatalogTab)}
          items={[
            { id: "catalog", label: t("tabCatalog") },
            { id: "graph", label: t("tabGraph") },
          ]}
        />
      </div>
      {showGraphFilter ? (
        <MenuSelect
          variant="toolbar"
          menuPortal
          className="min-w-[6.5rem] max-w-[12rem]"
          triggerClassName={pageOpsControlClass}
          value={filterWorksetId ?? GRAPH_FILTER_ALL}
          options={graphFilterOptions}
          onChange={(value) => setGraphFilter(value === GRAPH_FILTER_ALL ? null : value)}
          aria-label={t("graphFilterAria")}
          data-testid="workset-graph-filter"
        />
      ) : null}
    </div>
  );
}
