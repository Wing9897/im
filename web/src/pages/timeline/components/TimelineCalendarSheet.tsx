import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { ModalDialog } from "../../../components/ModalDialog";
import { dialogShellClass } from "../../../components/dialogs/dialogShellClasses";
import { Button } from "../../../components/ui";
import { subscriptionsWorkspaceNavItems } from "../../../domain/navigation/workspaceNav";
import { SchedulePage } from "../schedule/SchedulePage";
import {
  parseSubscriptionsTab,
  SubscriptionsShell,
  type SubscriptionsTabId,
} from "../subscriptions/SubscriptionsShell";

const SUBSCRIPTION_SHEET_TABS = new Set<string>(
  subscriptionsWorkspaceNavItems.map((item) => item.id),
);

function isSubscriptionSheetTab(value: string | null): value is SubscriptionsTabId {
  return !!value && SUBSCRIPTION_SHEET_TABS.has(value);
}

const calendarSheetShellClass = `box-border w-[92vw] max-w-[960px] max-h-[88vh] ${dialogShellClass} flex flex-col`;

/** Timeline side sheet for 我的日程 and subscription management (`?sheet=`). */
export function TimelineCalendarSheet() {
  const [params, setParams] = useSearchParams();
  const { t } = useTranslation(["timeline", "common"]);
  const sheet = params.get("sheet");
  const open = sheet === "schedule" || sheet === "subscriptions";
  if (!open) return null;

  const close = () => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const sheetKind = next.get("sheet");
        next.delete("sheet");
        next.delete("series");
        // `tab` on this sheet is the subscriptions section. Other pages share
        // the same key (task graph, source platform); leave those alone.
        // Closing 我的日程 must not clear a subscriptions tab that is still in the URL.
        if (sheetKind === "subscriptions" && isSubscriptionSheetTab(next.get("tab"))) {
          next.delete("tab");
        }
        return next;
      },
      { replace: true },
    );
  };

  const setTab = (tab: SubscriptionsTabId) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("sheet", "subscriptions");
        next.set("tab", tab);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <ModalDialog
      open
      size="xl"
      shellClassName={calendarSheetShellClass}
      testId="timeline-calendar-sheet"
      title={sheet === "schedule" ? t("toolbar.mySchedule") : t("toolbar.manageSubscriptions")}
      closeAriaLabel={t("common:dialog.close")}
      onClose={close}
      footer={
        <Button type="button" variant="secondary" onClick={close}>
          {t("common:dialog.close")}
        </Button>
      }
    >
      {sheet === "schedule" ? (
        <SchedulePage embedded />
      ) : (
        <SubscriptionsShell
          embedded
          tab={parseSubscriptionsTab(params.get("tab"))}
          onTabChange={setTab}
        />
      )}
    </ModalDialog>
  );
}
