import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageBreadcrumb, SegmentedControl } from "../../components/ui";
import { pageShellRootClass } from "../../components/ui/pageLayout";
import {
  subscriptionsWorkspaceNavItems,
  type SubscriptionsWorkspaceTabId,
} from "../../domain/navigation/workspaceNav";
import { SubscriptionsIdentityPanel } from "./SubscriptionsIdentityPanel";
import { SubscriptionsMinePage } from "./SubscriptionsMinePage";
import { SubscriptionsPublishedPage } from "./SubscriptionsPublishedPage";
import { SubscriptionsSearchPage } from "./SubscriptionsSearchPage";

export const SUBSCRIPTIONS_TAB_IDS = subscriptionsWorkspaceNavItems.map((item) => item.id);

export type SubscriptionsTabId = SubscriptionsWorkspaceTabId;

export function parseSubscriptionsTab(value: string | null | undefined): SubscriptionsTabId {
  if (value && (SUBSCRIPTIONS_TAB_IDS as readonly string[]).includes(value)) {
    return value as SubscriptionsTabId;
  }
  return "mine";
}

type SubscriptionsShellProps = {
  /** Active tab. The sheet passes `?tab=`; the shell does not read the pathname. */
  tab?: SubscriptionsTabId;
  onTabChange?: (tab: SubscriptionsTabId) => void;
  embedded?: boolean;
};

/** Subscriptions workspace: mine / published / account / search. */
export function SubscriptionsShell({
  tab = "mine",
  onTabChange,
  embedded = false,
}: SubscriptionsShellProps) {
  const { t } = useTranslation("subscriptions");
  const [uncontrolled, setUncontrolled] = useState<SubscriptionsTabId>(tab);
  const current = onTabChange ? tab : uncontrolled;

  useEffect(() => {
    if (!onTabChange) setUncontrolled(tab);
  }, [onTabChange, tab]);

  const select = (next: string) => {
    const id = parseSubscriptionsTab(next);
    if (onTabChange) onTabChange(id);
    else setUncontrolled(id);
  };

  const currentItem =
    subscriptionsWorkspaceNavItems.find((item) => item.id === current) ??
    subscriptionsWorkspaceNavItems[0];

  const containerClass = embedded
    ? "flex w-full min-w-0 flex-col gap-md"
    : `${pageShellRootClass} max-w-[1200px]`;

  return (
    <div className={containerClass} data-testid="subscriptions-shell">
      {embedded ? null : (
        <PageBreadcrumb
          className="!mb-0"
          items={[{ label: t("root") }, { label: currentItem ? t(currentItem.labelKey) : t("root") }]}
        />
      )}
      <SegmentedControl
        className="!mb-0"
        ariaLabel={t("tabsAria")}
        value={current}
        onChange={select}
        items={subscriptionsWorkspaceNavItems.map((item) => ({
          id: item.id,
          label: t(item.labelKey),
        }))}
      />
      <div className="min-w-0">
        {current === "mine" ? <SubscriptionsMinePage /> : null}
        {current === "published" ? <SubscriptionsPublishedPage /> : null}
        {current === "account" ? <SubscriptionsIdentityPanel /> : null}
        {current === "search" ? <SubscriptionsSearchPage /> : null}
      </div>
    </div>
  );
}
