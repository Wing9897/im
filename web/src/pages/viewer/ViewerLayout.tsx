/**
 * Layout wrapper for the /viewer route family.
 * Provides navigation between viewer sub-routes (tasks, results, status).
 */

import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

function navLinkClass(isActive: boolean): string {
  return [
    "rounded-md px-md py-sm text-sm no-underline transition-colors",
    isActive
      ? "bg-surface-overlay font-semibold text-accent"
      : "bg-transparent font-medium text-text-secondary hover:text-text-primary",
  ]
    .filter(Boolean)
    .join(" ");
}

export function ViewerLayout() {
  const { t } = useTranslation("common");

  return (
    <div className="im-page-shell min-h-screen bg-surface-base">
      <nav
        className="im-surface-chrome flex items-center gap-lg border-b border-surface-border px-2xl py-md"
        aria-label={t("viewer.navAria")}
      >
        <span className="mr-lg flex min-w-0 flex-col leading-tight">
          <span className="text-body text-text-primary">{t("viewer.brand")}</span>
          <span className="text-[10px] font-normal text-text-muted">
            {t("viewer.brandHint")}
          </span>
        </span>
        <div className="flex flex-1 gap-sm">
          <NavLink to="/viewer/tasks" className={({ isActive }) => navLinkClass(isActive)}>
            {t("viewer.navTasks")}
          </NavLink>
          <NavLink to="/viewer/results" className={({ isActive }) => navLinkClass(isActive)}>
            {t("viewer.navResults")}
          </NavLink>
          <NavLink to="/viewer/status" className={({ isActive }) => navLinkClass(isActive)}>
            {t("viewer.navStatus")}
          </NavLink>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
