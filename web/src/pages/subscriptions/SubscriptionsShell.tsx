import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageBreadcrumb, SegmentedTabs, type SegmentedTabItem } from "../../components/ui";
import { pageShellRootClass } from "../../components/ui/pageLayout";
import { subscriptionsWorkspaceNavItems } from "../../domain/navigation/workspaceNav";

/** Subscriptions workspace: mine / published / account / search. */
export function SubscriptionsShell() {
  const { t } = useTranslation("subscriptions");
  const { pathname } = useLocation();

  const tabs: SegmentedTabItem[] = subscriptionsWorkspaceNavItems.map(({ to, labelKey }) => ({
    to,
    label: t(labelKey),
  }));

  const current =
    subscriptionsWorkspaceNavItems.find((item) => pathname === item.to) ??
    subscriptionsWorkspaceNavItems.find((item) => pathname.startsWith(`${item.to}/`));

  return (
    <div className={`${pageShellRootClass} max-w-[1200px]`} data-testid="subscriptions-shell">
      <PageBreadcrumb
        className="!mb-0"
        items={[
          { label: t("root"), to: "/subscriptions/mine" },
          { label: current ? t(current.labelKey) : t("root") },
        ]}
      />
      <SegmentedTabs className="!mb-0" items={tabs} ariaLabel={t("tabsAria")} />
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
