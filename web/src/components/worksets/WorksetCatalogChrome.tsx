import { GitBranch, LayoutGrid } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SegmentedControl } from "../ui";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import {
  parseWorksetCatalogTab,
  WORKSET_GRAPH_FILTER_PARAM,
  worksetsCatalogPath,
  type WorksetCatalogTab,
} from "../../domain/worksets/worksetRoutes";
import { WorksetGraphFilterControl } from "./WorksetGraphFilterControl";

function isWorksetDetailPath(pathname: string): boolean {
  return /^\/worksets\/.+/u.test(pathname);
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
  const showGraphFilter = !onDetail && activeTab === "graph";

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
            if (tab !== "graph") next.delete(WORKSET_GRAPH_FILTER_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [navigate, onDetail, setSearchParams],
  );

  const items = [
    {
      id: "catalog",
      label: t("tabCatalog"),
      icon: <LayoutGrid size={14} strokeWidth={2.25} aria-hidden="true" />,
    },
    {
      id: "graph",
      label: t("tabGraph"),
      icon: <GitBranch size={14} strokeWidth={2.25} aria-hidden="true" />,
    },
  ];

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <div data-testid="workset-catalog-tabs" className="shrink-0">
        <SegmentedControl
          layout="inline"
          ariaLabel={t("catalogTabsAria")}
          value={activeTab}
          onChange={(id) => setActiveTab(id as WorksetCatalogTab)}
          items={items}
        />
      </div>
      {showGraphFilter ? <WorksetGraphFilterControl worksets={worksets} /> : null}
    </div>
  );
}
