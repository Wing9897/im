import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound, Smartphone, UserRound } from "lucide-react";
import { PageBreadcrumb, SegmentedTabs, type SegmentedTabItem } from "../../components/ui";
import { pageShellRootClass } from "../../components/ui/pageLayout";

const TAB_ITEMS = [
  { to: "/account/identity", labelKey: "account:tabs.identity", Icon: UserRound },
  { to: "/account/devices", labelKey: "account:tabs.devices", Icon: Smartphone },
  { to: "/account/keys", labelKey: "account:tabs.keys", Icon: KeyRound },
] as const;

/** Multi-device account workspace: identity / devices / access keys. */
export function AccountShell() {
  const { t } = useTranslation("common");
  const { pathname } = useLocation();

  const tabs: SegmentedTabItem[] = TAB_ITEMS.map(({ to, labelKey, Icon }) => ({
    to,
    label: t(labelKey),
    icon: <Icon size={14} strokeWidth={2} aria-hidden="true" />,
  }));

  const current =
    TAB_ITEMS.find((item) => pathname === item.to) ??
    TAB_ITEMS.find((item) => pathname.startsWith(`${item.to}/`));

  return (
    <div className={`${pageShellRootClass} max-w-[1200px]`} data-testid="account-shell">
      <PageBreadcrumb
        items={[
          { label: t("account:root"), to: "/account/identity" },
          { label: current ? t(current.labelKey) : t("account:root") },
        ]}
      />
      <SegmentedTabs items={tabs} ariaLabel={t("account:tabsAria")} />
      <div className="mt-lg">
        <Outlet />
      </div>
    </div>
  );
}
