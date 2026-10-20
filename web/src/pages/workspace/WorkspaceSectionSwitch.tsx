import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SegmentedControl } from "../../components/ui";
import { useSimpleMode } from "../../context/SimpleModeContext";
import { resolveWorkspaceTab, workspaceTabPath, type WorkspaceTab } from "./workspaceNav";

/** 任務 | 來源 | 流程圖. Hidden in simple mode (those routes stay gated). */
export function WorkspaceSectionSwitch() {
  const { t } = useTranslation("nav");
  const { simpleMode } = useSimpleMode();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  if (simpleMode) return null;

  const tab = resolveWorkspaceTab(pathname, searchParams.get("tab"));

  return (
    <div className="shrink-0" data-testid="workspace-section-tabs">
      <SegmentedControl
        layout="inline"
        ariaLabel={t("workspaceTabsAria")}
        value={tab}
        onChange={(id) => navigate(workspaceTabPath(id as WorkspaceTab))}
        items={[
          { id: "tasks", label: t("workspaceTasks") },
          { id: "sources", label: t("workspaceSources") },
          { id: "graph", label: t("workspaceGraph") },
        ]}
      />
    </div>
  );
}
