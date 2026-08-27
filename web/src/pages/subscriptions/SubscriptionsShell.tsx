import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageBreadcrumb, SegmentedTabs, type SegmentedTabItem } from "../../components/ui";
import { pageShellRootClass } from "../../components/ui/pageLayout";

const TAB_ITEMS = [
  { to: "/subscriptions/mine", labelKey: "tabs.mine" },
  { to: "/subscriptions/search", labelKey: "tabs.search" },
] as const;

/** Subscriptions workspace: IC-backed mine list / search remote calendars. */
export function SubscriptionsShell() {
  const { t } = useTranslation("subscriptions");
  const { pathname } = useLocation();

  const tabs: SegmentedTabItem[] = TAB_ITEMS.map(({ to, labelKey }) => ({
    to,
    label: t(labelKey),
  }));

  const current =
    TAB_ITEMS.find((item) => pathname === item.to) ??
    TAB_ITEMS.find((item) => pathname.startsWith(`${item.to}/`));

  return (
    <div className={`${pageShellRootClass} max-w-[1200px]`} data-testid="subscriptions-shell">
      <PageBreadcrumb
        items={[
          { label: t("root"), to: "/subscriptions/mine" },
          { label: current ? t(current.labelKey) : t("root") },
        ]}
      />
      <SegmentedTabs items={tabs} ariaLabel={t("tabsAria")} />
      <div className="mt-lg">
        <Outlet />
      </div>
    </div>
  );
}
