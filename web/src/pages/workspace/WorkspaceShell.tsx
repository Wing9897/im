import { useLocation, useSearchParams } from "react-router-dom";

import { DashboardViewer } from "../dashboard/DashboardViewer";
import { SourceManagementPage } from "../sources/SourceManagementPage";
import { resolveWorkspaceTab } from "./workspaceNav";

/** Tasks, sources, and the pipeline graph share one workspace. Section tabs live in each page bar. */
export function WorkspaceShell() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const tab = resolveWorkspaceTab(pathname, searchParams.get("tab"));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="workspace-shell">
      {tab === "sources" ? <SourceManagementPage /> : <DashboardViewer />}
    </div>
  );
}
