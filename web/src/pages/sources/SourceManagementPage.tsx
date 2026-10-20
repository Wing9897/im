import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { SourceTabKey } from "../../types/sources";
import { AppPageShell, Button } from "../../components/ui";
import { readReturnTo } from "../../routing/returnTo";
import { WorkspaceSectionSwitch } from "../workspace/WorkspaceSectionSwitch";
import { SourceTabNav } from "./SourceTabNav";
import { getSourcePlatformPlugin, isSourceTabKey } from "./plugins";
import type { SourcePlatformTabProps } from "./plugins/types";

export function SourceManagementPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation("sources");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam: NonNullable<SourcePlatformTabProps["tabParam"]> = embedded ? "sourceTab" : "tab";
  const modeParam: NonNullable<SourcePlatformTabProps["modeParam"]> = embedded ? "sourceMode" : "mode";
  const returnPath = embedded ? "" : readReturnTo(searchParams.toString(), "");

  const activeTab = useMemo(() => {
    const tab = searchParams.get(tabParam);
    return isSourceTabKey(tab) ? tab : "telegram";
  }, [searchParams, tabParam]);

  const setActiveTab = useCallback(
    (tab: SourceTabKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === "telegram") next.delete(tabParam);
          else next.set(tabParam, tab);
          // Leaving HTTP clears poll/webhook sub-mode for this surface only.
          if (tab !== "http") next.delete(modeParam);
          return next;
        },
        { replace: true },
      );
    },
    [modeParam, setSearchParams, tabParam],
  );

  const { Tab } = getSourcePlatformPlugin(activeTab);

  const body = (
    <>
      {embedded ? (
        <SourceTabNav activeTab={activeTab} onTabChange={setActiveTab} flush />
      ) : (
        <div
          className="mb-xl flex min-w-0 flex-wrap items-center gap-2"
          data-testid="sources-toolbar"
        >
          {returnPath ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="sources-return"
              onClick={() => navigate(returnPath)}
            >
              {t("drawer.back")}
            </Button>
          ) : null}
          <WorkspaceSectionSwitch />
          <SourceTabNav activeTab={activeTab} onTabChange={setActiveTab} flush />
        </div>
      )}
      <Tab tabParam={tabParam} modeParam={modeParam} />
    </>
  );

  if (embedded) {
    return (
      <div className="flex min-w-0 flex-col gap-md" data-testid="source-drawer-form">
        {body}
      </div>
    );
  }

  return <AppPageShell width="fluid">{body}</AppPageShell>;
}
