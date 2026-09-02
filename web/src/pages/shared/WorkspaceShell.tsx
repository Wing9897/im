import { Outlet, useLocation } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { SectionErrorBoundary } from "../../components/common/SectionErrorBoundary";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import {
  AlertBanner,
  PageBreadcrumb,
  SegmentedTabs,
  type SegmentedTabItem,
} from "../../components/ui";
import { pageShellRootClass } from "../../components/ui/pageLayout";
import { SETTINGS_AI_BASE, settingsWorkspaceNavItems } from "../../domain/navigation/workspaceNav";
import type { WorkspaceNavItem } from "../../types";
import type { SystemSettingsPageState } from "../../hooks/useSystemSettingsPage";
import { useErrorToast } from "../../hooks/useErrorToast";
import { workspaceTabIcons } from "./WorkspaceNavIcons";

type SettingsPageState = SystemSettingsPageState;
type WorkspaceTabItem = Pick<WorkspaceNavItem, "to" | "labelKey">;

export const settingsTabItems = settingsWorkspaceNavItems.map(({ to, labelKey }) => ({
  to,
  labelKey,
})) as readonly WorkspaceTabItem[];

function toSegmentedItems(
  tabItems: readonly WorkspaceTabItem[],
  t: (key: string) => string,
): SegmentedTabItem[] {
  return tabItems.map((item) => {
    const Icon = workspaceTabIcons[item.to];
    return {
      to: item.to,
      label: t(item.labelKey),
      icon: Icon ? <Icon size={14} strokeWidth={2} aria-hidden="true" /> : undefined,
    };
  });
}

export function SettingsTopTabs() {
  const { t } = useTranslation("settings");
  return (
    <SegmentedTabs
      items={toSegmentedItems(settingsTabItems, t)}
      ariaLabel={t("shell.tabsAria")}
    />
  );
}

function useWorkspaceBreadcrumbRoot(pathname: string): { label: string; to: string } {
  const { t } = useTranslation(["settings", "nav"]);
  if (pathname.startsWith(SETTINGS_AI_BASE)) {
    // Canonical label: nav.aiSettings (same as sidebar).
    return { label: t("nav:aiSettings"), to: SETTINGS_AI_BASE };
  }
  // Canonical label: nav.systemSettings (same as sidebar).
  return { label: t("nav:systemSettings"), to: "/settings" };
}

export function SettingsWorkspaceShell({
  tabItems,
  pageState,
  sectionName,
}: {
  tabItems: readonly WorkspaceTabItem[];
  pageState: SettingsPageState;
  sectionName: string;
}) {
  const { t } = useTranslation("settings");
  const { pathname } = useLocation();
  const {
    settings,
    savedSnapshot,
    saving,
    error,
    hasUnsavedChanges,
    showConcurrentBatchesWarning,
    confirmConcurrentBatchesSave,
    cancelConcurrentBatchesSave,
  } = pageState;
  useErrorToast(error);

  const root = useWorkspaceBreadcrumbRoot(pathname);
  const currentTab =
    tabItems.find((item) => pathname === item.to) ??
    tabItems.find((item) => pathname.startsWith(`${item.to}/`));

  return (
    <div className={`${pageShellRootClass} max-w-[1200px]`}>
      <PageBreadcrumb
        items={[
          { label: root.label, to: root.to },
          { label: currentTab ? t(currentTab.labelKey) : sectionName },
        ]}
      />

      {hasUnsavedChanges ? (
        <AlertBanner variant="warning" className="text-caption">
          {t("shell.unsavedChanges")}
        </AlertBanner>
      ) : null}

      <SegmentedTabs
        items={toSegmentedItems(tabItems, t)}
        ariaLabel={t("shell.tabsAria")}
      />

      <div className="min-w-0">
        {!settings ? (
          <div className="text-caption text-text-secondary">{t("shell.loadingSettings")}</div>
        ) : (
          <SectionErrorBoundary sectionName={sectionName}>
            <Outlet context={pageState} />
          </SectionErrorBoundary>
        )}
        {saving ? (
          <div className="mt-sm text-caption text-text-secondary">{t("shell.savingSettings")}</div>
        ) : null}
      </div>

      {showConcurrentBatchesWarning && settings && savedSnapshot ? (
        <ConfirmDialog
          title={t("concurrentBatchesConfirm.title")}
          accentColor="var(--warning)"
          confirmLabel={t("concurrentBatchesConfirm.confirmLabel")}
          confirmBusyLabel={t("shared.saving")}
          busy={saving}
          onConfirm={confirmConcurrentBatchesSave}
          onCancel={cancelConcurrentBatchesSave}
          body={
            <>
              <p className="mb-sm mt-0">
                <Trans
                  i18nKey="settings:concurrentBatchesConfirm.bodyChange"
                  values={{
                    from: savedSnapshot.maxConcurrentBatches,
                    to: settings.maxConcurrentBatches,
                  }}
                  components={{ strong: <strong /> }}
                />
              </p>
              <p className="mb-xs mt-0">{t("concurrentBatchesConfirm.bodyCostWarning")}</p>
              <p className="m-0">{t("concurrentBatchesConfirm.bodyLocalWarning")}</p>
            </>
          }
        />
      ) : null}
    </div>
  );
}
