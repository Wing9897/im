import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshIndicator } from "../common/RefreshIndicator";
import { Button } from "./Button";
import { AlertBanner } from "./AlertBanner";

interface ViewerShellProps {
  initialLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  retry: () => void;
  refreshLabel: string;
  children: ReactNode;
}

/** Shared loading, error, and refresh chrome for viewer resource pages. */
export function ViewerShell({
  initialLoading,
  isRefreshing,
  error,
  retry,
  refreshLabel,
  children,
}: ViewerShellProps) {
  const { t } = useTranslation("common");
  const containerClass =
    "mx-auto box-border max-w-[720px] px-page-x py-page-y max-[780px]:px-lg max-[780px]:py-2xl";

  if (initialLoading) {
    return (
      <div className={containerClass}>
        <p className="text-body text-text-secondary">{t("ui.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClass}>
        <AlertBanner variant="error" role="alert" className="flex-col items-start">
          <p>{error}</p>
          <Button type="button" variant="primary" size="sm" className="mt-md" onClick={retry}>
            {t("viewer.reload")}
          </Button>
        </AlertBanner>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {isRefreshing ? (
        <div className="mb-sm flex justify-end">
          <RefreshIndicator label={refreshLabel} />
        </div>
      ) : null}
      {children}
    </div>
  );
}
