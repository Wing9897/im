import React from "react";
import { useTranslation } from "react-i18next";

import { AlertBanner, Button } from "../ui";

interface ErrorRetryBannerProps {
  error: string;
  retrying?: boolean;
  onRetry?: () => void;
}

export const ErrorRetryBanner = React.memo(function ErrorRetryBanner({
  error,
  retrying,
  onRetry,
}: ErrorRetryBannerProps) {
  const { t } = useTranslation("common");

  return (
    <AlertBanner variant="error" role="alert" className="items-center justify-between gap-md py-md text-body">
      <span className="min-w-0 flex-1">{error}</span>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void onRetry()}
          disabled={retrying}
          aria-label={t("ui.retryLoadAria")}
        >
          {retrying ? t("ui.retrying") : t("ui.retry")}
        </Button>
      ) : null}
    </AlertBanner>
  );
});
