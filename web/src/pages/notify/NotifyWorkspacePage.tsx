import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppPageShell } from "../../components/ui";
import { ActionTypesTab } from "./components/ActionTypesTab";
import { ActionHistoryTab } from "./components/ActionHistoryTab";
import { ActionsTabNav } from "./components/ActionsTabNav";
import { isActionsTabKey, type ActionsTabKey } from "./actionsTab";
import { LocalNotifyPanel } from "./components/LocalNotifyPanel";

/**
 * Notifications workspace — three concerns stay separate:
 * outbound ActionType rules, local notifications, and trigger history.
 * Tab state is `?tab=` (same pattern as source management).
 * Default wire tab id is `"types"` (ActionTypesTab).
 * Unknown `?tab=` values (including retired `voice`) fall back to types — no redirect.
 */
export function NotifyWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo((): ActionsTabKey => {
    const tab = searchParams.get("tab");
    return isActionsTabKey(tab) ? tab : "types";
  }, [searchParams]);

  const setActiveTab = useCallback(
    (tab: ActionsTabKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === "types") next.delete("tab");
          else next.set("tab", tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <AppPageShell>
      <ActionsTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "types" ? <ActionTypesTab /> : null}
      {activeTab === "notify" ? <LocalNotifyPanel /> : null}
      {activeTab === "history" ? <ActionHistoryTab /> : null}
    </AppPageShell>
  );
}
