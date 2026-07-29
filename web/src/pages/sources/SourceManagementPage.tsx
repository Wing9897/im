import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { SourceTabKey } from "../../types/sources";
import { AppPageShell } from "../../components/ui";
import { SourceTabNav } from "./SourceTabNav";
import { getSourcePlatformPlugin, isSourceTabKey } from "./plugins";

export function SourceManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return isSourceTabKey(tab) ? tab : "telegram";
  }, [searchParams]);

  const setActiveTab = useCallback(
    (tab: SourceTabKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === "telegram") next.delete("tab");
          else next.set("tab", tab);
          // Leaving HTTP clears poll/webhook sub-mode.
          if (tab !== "http") next.delete("mode");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { Tab } = getSourcePlatformPlugin(activeTab);

  return (
    <AppPageShell width="fluid">
      <SourceTabNav activeTab={activeTab} onTabChange={setActiveTab} />
      <Tab />
    </AppPageShell>
  );
}
